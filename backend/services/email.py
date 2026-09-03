"""
backend/services/email.py
Email Dispatch Service for CloseIt Invoice Recovery.
Sends payment reminders via SMTP or falls back to structured logging for demo simulation.
"""

import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any

logger = logging.getLogger("closeit.email")

def send_email(to_email: str, subject: str, body: str) -> Dict[str, Any]:
    """
    Sends an email reminder to a client regarding an overdue invoice.
    Falls back gracefully if SMTP credentials are not configured.
    """
    email_addr = os.getenv("EMAIL_ADDRESS", "")
    email_pass = os.getenv("EMAIL_APP_PASSWORD", "")

    if email_addr and email_pass:
        try:
            msg = MIMEMultipart()
            msg["From"] = email_addr
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))

            server = smtplib.SMTP("smtp.gmail.com", 587)
            server.starttls()
            server.login(email_addr, email_pass)
            server.send_message(msg)
            server.quit()

            logger.info(f"Email successfully sent via SMTP to {to_email}")
            return {
                "success": True,
                "mode": "smtp",
                "recipient": to_email,
                "message": "Email sent successfully via SMTP."
            }
        except Exception as e:
            logger.warning(f"SMTP email dispatch failed: {e}. Falling back to demo simulation.")
    
    # Demo Simulation Fallback
    logger.info(f"[DEMO EMAIL DISPATCH SIMULATED]\nTo: {to_email}\nSubject: {subject}\nBody:\n{body}\n")
    return {
        "success": True,
        "mode": "simulated",
        "recipient": to_email,
        "message": f"Email reminder simulated successfully for {to_email}."
    }
