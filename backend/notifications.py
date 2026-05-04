"""SOS notification dispatch — Twilio SMS + Resend email.

Sends notifications when an SOS alert is triggered. Degrades gracefully:
- if Twilio env vars are not set, SMS is skipped
- if Resend env var is not set, email is skipped
- all failures are logged but never raised to the caller
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import List, Optional

logger = logging.getLogger(__name__)


def _twilio_configured() -> bool:
    return bool(os.environ.get("TWILIO_ACCOUNT_SID") and os.environ.get("TWILIO_AUTH_TOKEN") and os.environ.get("TWILIO_FROM_NUMBER"))


def _resend_configured() -> bool:
    return bool(os.environ.get("RESEND_API_KEY"))


def _maps_link(lat: Optional[float], lng: Optional[float]) -> str:
    if lat is None or lng is None:
        return "Location unavailable"
    return f"https://www.google.com/maps?q={lat},{lng}"


def build_sms_body(*, user_name: str, threat_level: str, lat: Optional[float], lng: Optional[float], note: Optional[str]) -> str:
    parts = [
        f"🚨 HerNet SOS · {threat_level.upper()} threat",
        f"From: {user_name}",
        f"Location: {_maps_link(lat, lng)}",
    ]
    if note:
        parts.append(f"Note: {note}")
    parts.append("Reply or call immediately.")
    return "\n".join(parts)


def build_email_html(*, user_name: str, user_phone: Optional[str], threat_level: str,
                     lat: Optional[float], lng: Optional[float], note: Optional[str]) -> tuple[str, str]:
    maps = _maps_link(lat, lng)
    level_color = {"high": "#dc2626", "medium": "#f59e0b", "low": "#16a34a"}.get(threat_level, "#dc2626")
    subject = f"HerNet SOS · {threat_level.upper()} · {user_name}"
    html = f"""
    <table style="width:100%;max-width:560px;margin:0 auto;font-family:Arial,sans-serif;background:#0a0a0a;color:#ffffff;padding:0;border-collapse:collapse">
      <tr>
        <td style="padding:24px 32px;background:{level_color};color:#ffffff">
          <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;font-weight:700">HerNet Alert</div>
          <div style="font-size:28px;font-weight:900;margin-top:8px">{threat_level.upper()} THREAT · SOS</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px;background:#ffffff;color:#0a0a0a">
          <p style="margin:0 0 16px 0;font-size:16px"><strong>{user_name}</strong> has triggered an emergency alert.</p>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#71717a">Phone</td>
                <td style="padding:8px 0;font-size:14px">{user_phone or 'Not provided'}</td></tr>
            <tr><td style="padding:8px 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#71717a">Threat</td>
                <td style="padding:8px 0;font-size:14px;color:{level_color};font-weight:700">{threat_level.upper()}</td></tr>
            <tr><td style="padding:8px 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#71717a">Location</td>
                <td style="padding:8px 0;font-size:14px"><a href="{maps}" style="color:{level_color}">{maps}</a></td></tr>
            {f'<tr><td style="padding:8px 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#71717a">Note</td><td style="padding:8px 0;font-size:14px">{note}</td></tr>' if note else ''}
          </table>
          <div style="margin-top:24px;padding:16px;background:#fff1f2;border-left:4px solid {level_color};font-size:13px">
            Take action now. Contact the user or dispatch a responder immediately.
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px;background:#18181b;color:#a1a1aa;font-size:11px;letter-spacing:2px;text-transform:uppercase">
          HerNet Safety Network · Automated Alert
        </td>
      </tr>
    </table>
    """
    return subject, html


def _send_sms_sync(to: str, body: str, *, sid: str, token: str, from_number: str) -> dict:
    from twilio.rest import Client
    client = Client(sid, token)
    msg = client.messages.create(to=to, from_=from_number, body=body)
    return {"sid": msg.sid, "status": msg.status, "to": to}


def _send_email_sync(to: List[str], subject: str, html: str, *, api_key: str, sender: str) -> dict:
    import resend
    resend.api_key = api_key
    res = resend.Emails.send({"from": sender, "to": to, "subject": subject, "html": html})
    return {"id": res.get("id"), "to": to}


async def dispatch_sos_notifications(
    *,
    user_name: str,
    user_phone: Optional[str],
    threat_level: str,
    lat: Optional[float],
    lng: Optional[float],
    note: Optional[str],
    sms_recipients: List[str],
    email_recipients: List[str],
) -> dict:
    """Fire SMS + email notifications concurrently. Always returns a result dict."""
    summary = {
        "sms": {"configured": _twilio_configured(), "sent": 0, "failed": 0, "errors": []},
        "email": {"configured": _resend_configured(), "sent": 0, "failed": 0, "errors": []},
    }

    # SMS
    if _twilio_configured() and sms_recipients:
        sid = os.environ["TWILIO_ACCOUNT_SID"]
        token = os.environ["TWILIO_AUTH_TOKEN"]
        from_number = os.environ["TWILIO_FROM_NUMBER"]
        body = build_sms_body(user_name=user_name, threat_level=threat_level, lat=lat, lng=lng, note=note)

        async def _one_sms(num: str):
            try:
                await asyncio.to_thread(_send_sms_sync, num, body, sid=sid, token=token, from_number=from_number)
                summary["sms"]["sent"] += 1
            except Exception as e:
                summary["sms"]["failed"] += 1
                summary["sms"]["errors"].append(f"{num}: {e}")
                logger.warning("SOS SMS to %s failed: %s", num, e)

        await asyncio.gather(*[_one_sms(n) for n in sms_recipients])

    # Email
    if _resend_configured() and email_recipients:
        api_key = os.environ["RESEND_API_KEY"]
        sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
        subject, html = build_email_html(
            user_name=user_name, user_phone=user_phone, threat_level=threat_level,
            lat=lat, lng=lng, note=note,
        )
        try:
            await asyncio.to_thread(_send_email_sync, email_recipients, subject, html, api_key=api_key, sender=sender)
            summary["email"]["sent"] = len(email_recipients)
        except Exception as e:
            summary["email"]["failed"] = len(email_recipients)
            summary["email"]["errors"].append(str(e))
            logger.warning("SOS email failed: %s", e)

    logger.info("SOS dispatch summary: %s", summary)
    return summary
