from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import asyncio
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal
from contextlib import asynccontextmanager

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

from notifications import dispatch_sos_notifications


# --- Mongo ---
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# --- JWT ---
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
ACCESS_TTL_MIN = 60 * 24  # 24h for this app

bearer_scheme = HTTPBearer(auto_error=False)

Role = Literal["user", "admin", "authority"]


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


# --- Models ---
class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    name: str
    role: Role
    phone: Optional[str] = None
    created_at: datetime

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    phone: Optional[str] = None
    role: Role = "user"

class LoginIn(BaseModel):
    email: EmailStr
    password: str
    role: Optional[Role] = None  # optional role hint from UI

class AuthOut(BaseModel):
    token: str
    user: UserPublic

class EmergencyContactIn(BaseModel):
    name: str
    phone: str
    relation: Optional[str] = None

class EmergencyContact(EmergencyContactIn):
    id: str
    user_id: str
    created_at: datetime

class LocationIn(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None

class SOSTriggerIn(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    threat_level: Literal["low", "medium", "high"] = "high"
    note: Optional[str] = None

class SOSAlert(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_phone: Optional[str] = None
    status: Literal["active", "resolved", "dismissed"]
    threat_level: Literal["low", "medium", "high"]
    lat: Optional[float] = None
    lng: Optional[float] = None
    note: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None


class SOSTriggerOut(BaseModel):
    alert: SOSAlert
    notify_summary: dict

class ResolveIn(BaseModel):
    resolution_note: Optional[str] = None

class NewsletterIn(BaseModel):
    email: EmailStr

class ContactMessageIn(BaseModel):
    name: str
    email: EmailStr
    message: str


# --- Auth dep ---
async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> dict:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_role(*roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return checker


def _serialize_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u["name"],
        "role": u["role"],
        "phone": u.get("phone"),
        "created_at": u["created_at"] if isinstance(u["created_at"], datetime) else datetime.fromisoformat(u["created_at"]),
    }


# --- App ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.sos_alerts.create_index("status")
    await db.sos_alerts.create_index("user_id")
    await db.emergency_contacts.create_index("user_id")
    await db.locations.create_index("user_id")

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@hernet.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "HerNet@Admin2025")
    existing = await db.users.find_one({"email": admin_email})
    now = datetime.now(timezone.utc)
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "HerNet Admin",
            "role": "admin",
            "phone": None,
            "created_at": now.isoformat(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
    yield
    client.close()


app = FastAPI(lifespan=lifespan)
api = APIRouter(prefix="/api")


# --- Routes ---
@api.get("/")
async def root():
    return {"message": "HerNet API", "status": "ok"}


@api.post("/auth/register", response_model=AuthOut)
async def register(inp: RegisterIn):
    email = inp.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    # Only user/authority can self-register; admins are seeded
    role = inp.role if inp.role in ("user", "authority") else "user"
    uid = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_password(inp.password),
        "name": inp.name,
        "role": role,
        "phone": inp.phone,
        "created_at": now.isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(uid, email, role)
    return {"token": token, "user": _serialize_user(doc)}


@api.post("/auth/login", response_model=AuthOut)
async def login(inp: LoginIn):
    email = inp.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(inp.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if inp.role and user["role"] != inp.role:
        raise HTTPException(status_code=403, detail=f"Account is not a {inp.role} account")
    token = create_access_token(user["id"], user["email"], user["role"])
    return {"token": token, "user": _serialize_user(user)}


@api.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return _serialize_user(user)


# --- Emergency contacts ---
@api.get("/contacts", response_model=List[EmergencyContact])
async def list_contacts(user: dict = Depends(get_current_user)):
    docs = await db.emergency_contacts.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    for d in docs:
        if isinstance(d["created_at"], str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
    return docs


@api.post("/contacts", response_model=EmergencyContact)
async def add_contact(inp: EmergencyContactIn, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": inp.name,
        "phone": inp.phone,
        "relation": inp.relation,
        "created_at": now.isoformat(),
    }
    await db.emergency_contacts.insert_one(doc)
    return {**doc, "created_at": now}


@api.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, user: dict = Depends(get_current_user)):
    res = await db.emergency_contacts.delete_one({"id": contact_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"ok": True}


# --- Location ---
@api.post("/location/ping")
async def ping_location(inp: LocationIn, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "lat": inp.lat,
        "lng": inp.lng,
        "accuracy": inp.accuracy,
        "timestamp": now.isoformat(),
    }
    await db.locations.insert_one(doc)
    return {"ok": True, "timestamp": now}


# --- SOS ---
def _serialize_alert(a: dict) -> dict:
    out = dict(a)
    for k in ("created_at", "resolved_at"):
        v = out.get(k)
        if isinstance(v, str):
            out[k] = datetime.fromisoformat(v)
    return out


# --- Auto-escalation for HIGH threats ---
ESCALATION_SECONDS = int(os.environ.get("ESCALATION_SECONDS", "120"))


async def _escalate_if_unacknowledged(alert_id: str, delay: int = ESCALATION_SECONDS):
    """After `delay` seconds, if alert is still active, re-notify authorities + contacts."""
    try:
        await asyncio.sleep(delay)
        alert = await db.sos_alerts.find_one({"id": alert_id}, {"_id": 0})
        if not alert or alert.get("status") != "active":
            return  # already resolved or dismissed

        # Re-gather recipients (new contacts/authorities may have joined)
        contacts = await db.emergency_contacts.find(
            {"user_id": alert["user_id"]}, {"_id": 0, "phone": 1}
        ).to_list(100)
        sms_recipients = [c["phone"] for c in contacts if c.get("phone")]
        authorities = await db.users.find(
            {"role": "authority"}, {"_id": 0, "email": 1, "phone": 1}
        ).to_list(500)
        email_recipients = [a["email"] for a in authorities if a.get("email")]
        sms_recipients.extend([a["phone"] for a in authorities if a.get("phone")])

        escalated_note = f"[ESCALATED after {delay}s of inaction] {alert.get('note') or ''}".strip()
        summary = await dispatch_sos_notifications(
            user_name=alert["user_name"],
            user_phone=alert.get("user_phone"),
            threat_level=alert["threat_level"],
            lat=alert.get("lat"),
            lng=alert.get("lng"),
            note=escalated_note,
            sms_recipients=sms_recipients,
            email_recipients=email_recipients,
        )
        await db.sos_alerts.update_one(
            {"id": alert_id},
            {"$set": {
                "escalated": True,
                "escalated_at": datetime.now(timezone.utc).isoformat(),
                "escalation_summary": summary,
            }},
        )
        logger.warning("SOS alert %s escalated. summary=%s", alert_id, summary)
    except asyncio.CancelledError:
        raise
    except Exception as e:  # noqa: BLE001
        logger.error("Escalation failed for %s: %s", alert_id, e)


@api.post("/sos/trigger", response_model=SOSTriggerOut)
async def trigger_sos(inp: SOSTriggerIn, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_phone": user.get("phone"),
        "status": "active",
        "threat_level": inp.threat_level,
        "lat": inp.lat,
        "lng": inp.lng,
        "note": inp.note,
        "created_at": now.isoformat(),
        "resolved_at": None,
        "resolved_by": None,
    }
    await db.sos_alerts.insert_one(doc)

    # Dispatch notifications to emergency contacts (SMS) + verified authorities (email)
    contacts = await db.emergency_contacts.find(
        {"user_id": user["id"]}, {"_id": 0, "phone": 1, "name": 1}
    ).to_list(100)
    sms_recipients = [c["phone"] for c in contacts if c.get("phone")]

    authorities = await db.users.find(
        {"role": "authority"}, {"_id": 0, "email": 1, "phone": 1}
    ).to_list(500)
    email_recipients = [a["email"] for a in authorities if a.get("email")]
    # authorities with phone numbers also receive SMS
    sms_recipients.extend([a["phone"] for a in authorities if a.get("phone")])

    notify_summary = await dispatch_sos_notifications(
        user_name=user["name"],
        user_phone=user.get("phone"),
        threat_level=inp.threat_level,
        lat=inp.lat,
        lng=inp.lng,
        note=inp.note,
        sms_recipients=sms_recipients,
        email_recipients=email_recipients,
    )
    await db.sos_alerts.update_one(
        {"id": doc["id"]}, {"$set": {"notify_summary": notify_summary}}
    )
    return {"alert": _serialize_alert(doc), "notify_summary": notify_summary}


@api.get("/sos/my", response_model=List[SOSAlert])
async def my_alerts(user: dict = Depends(get_current_user)):
    docs = await db.sos_alerts.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [_serialize_alert(d) for d in docs]


@api.get("/sos/active", response_model=List[SOSAlert])
async def active_alerts(user: dict = Depends(require_role("admin", "authority"))):
    docs = await db.sos_alerts.find({"status": "active"}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [_serialize_alert(d) for d in docs]


@api.get("/sos/all", response_model=List[SOSAlert])
async def all_alerts(user: dict = Depends(require_role("admin", "authority"))):
    docs = await db.sos_alerts.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [_serialize_alert(d) for d in docs]


@api.post("/sos/{alert_id}/resolve", response_model=SOSAlert)
async def resolve_alert(alert_id: str, inp: ResolveIn, user: dict = Depends(require_role("admin", "authority"))):
    now = datetime.now(timezone.utc)
    res = await db.sos_alerts.find_one_and_update(
        {"id": alert_id},
        {"$set": {
            "status": "resolved",
            "resolved_at": now.isoformat(),
            "resolved_by": user["name"],
            "resolution_note": inp.resolution_note,
        }},
        projection={"_id": 0},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Alert not found")
    return _serialize_alert(res)


# --- Admin ---
@api.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_role("admin"))):
    total_users = await db.users.count_documents({"role": "user"})
    total_authorities = await db.users.count_documents({"role": "authority"})
    active = await db.sos_alerts.count_documents({"status": "active"})
    resolved = await db.sos_alerts.count_documents({"status": "resolved"})
    total_alerts = await db.sos_alerts.count_documents({})
    return {
        "total_users": total_users,
        "total_authorities": total_authorities,
        "active_alerts": active,
        "resolved_alerts": resolved,
        "total_alerts": total_alerts,
    }


@api.get("/admin/users", response_model=List[UserPublic])
async def admin_users(user: dict = Depends(require_role("admin"))):
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return [_serialize_user(d) for d in docs]


# --- Newsletter / Contact ---
@api.get("/notifications/status")
async def notifications_status(user: dict = Depends(get_current_user)):
    from notifications import _twilio_configured, _resend_configured
    return {
        "sms_enabled": _twilio_configured(),
        "email_enabled": _resend_configured(),
    }


@api.post("/newsletter/subscribe")
async def subscribe(inp: NewsletterIn):
    email = inp.email.lower()
    await db.newsletter.update_one(
        {"email": email},
        {"$setOnInsert": {"email": email, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@api.post("/contact")
async def contact(inp: ContactMessageIn):
    doc = {
        "id": str(uuid.uuid4()),
        "name": inp.name,
        "email": inp.email.lower(),
        "message": inp.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.contact_messages.insert_one(doc)
    return {"ok": True}


# --- register & cors ---
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
