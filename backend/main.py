import os
import pickle
import re
import shutil
import smtplib
import sqlite3
import string
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from email.message import EmailMessage
from functools import lru_cache
from io import BytesIO
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "complaint_app.db"
UPLOAD_DIR = BASE_DIR / "static" / "uploads"
MODEL_PATH = BASE_DIR / "modelbuilding" / "bilstm_glove_model.h5"
TOKENIZER_PATH = BASE_DIR / "modelbuilding" / "tokenizer.pkl"
LABEL_ENCODER_PATH = BASE_DIR / "modelbuilding" / "label_encoder.pkl"
TRAINING_DATA_PATH = BASE_DIR / "modelbuilding" / "all_complaints.csv"
PRIORITY_MODEL_PATH = BASE_DIR / "sentiment_model" / "priority_model.pkl"
MAX_WORDS = 10000
MAX_LEN = 100
DEPARTMENTS = [
    "Water Department",
    "Electricity Department",
    "Public Works Department",
    "Sanitation Department",
    "Health Department",
]
COMPLAINT_STATUSES = ["open", "work in progress", "closed"]
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_EMAIL = "yashrwanve@gmail.com"
SMTP_APP_PASSWORD = "utmu jnnx zgtg uciw"
LOCAL_BODY_TYPES = ["mahanagarpalika", "nagarpalika", "nagarpanchayat", "grampanchayat"]
STATES = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry",
]

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app):
    init_db()
    yield


app = FastAPI(title="Complaint App", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


LOCAL_BODY_LOGINS = [
    ("mahanagarpalika", "Mumbai", "Mumbai", "mumbai_mnp", "mumbai123"),
    ("mahanagarpalika", "Pune", "Pune", "pune_mnp", "pune123"),
    ("mahanagarpalika", "Nagpur", "Nagpur", "nagpur_mnp", "nagpur123"),
    ("mahanagarpalika", "Thane", "Thane", "thane_mnp", "thane123"),
    ("mahanagarpalika", "Nashik", "Nashik", "nashik_mnp", "nashik123"),
    ("mahanagarpalika", "Pimpri-Chinchwad", "Pune", "pcmc_mnp", "pcmc123"),
    ("mahanagarpalika", "Chhatrapati Sambhajinagar", "Chhatrapati Sambhajinagar", "sambhajinagar_mnp", "sambhaji123"),
    ("mahanagarpalika", "Solapur", "Solapur", "solapur_mnp", "solapur123"),
    ("mahanagarpalika", "Kolhapur", "Kolhapur", "kolhapur_mnp", "kolhapur123"),
    ("mahanagarpalika", "Navi Mumbai", "Thane", "navimumbai_mnp", "navi123"),
    ("nagarpalika", "Baramati", "Pune", "baramati_np", "baramati123"),
    ("nagarpalika", "Lonavala", "Pune", "lonavala_np", "lonavala123"),
    ("nagarpalika", "Talegaon-Dabhade", "Pune", "talegaon_np", "talegaon123"),
    ("nagarpalika", "Daund", "Pune", "daund_np", "daund123"),
    ("nagarpalika", "Chakan", "Pune", "chakan_np", "chakan123"),
    ("nagarpalika", "Shirur", "Pune", "shirur_np", "shirur123"),
    ("nagarpalika", "Indapur", "Pune", "indapur_np", "indapur123"),
    ("nagarpalika", "Saswad", "Pune", "saswad_np", "saswad123"),
    ("nagarpalika", "Alandi", "Pune", "alandi_np", "alandi123"),
    ("nagarpalika", "Alibag", "Raigad", "alibag_np", "alibag123"),
    ("nagarpanchayat", "Vadgaon-Maval", "Pune", "vadgaonmaval_ngp", "vadgaon123"),
    ("nagarpanchayat", "Dehu", "Pune", "dehu_ngp", "dehu123"),
    ("nagarpanchayat", "Manchar", "Pune", "manchar_ngp", "manchar123"),
    ("nagarpanchayat", "Bhiwapur", "Nagpur", "bhiwapur_ngp", "bhiwapur123"),
    ("nagarpanchayat", "Hingna", "Nagpur", "hingna_ngp", "hingna123"),
    ("nagarpanchayat", "Kuhi", "Nagpur", "kuhi_ngp", "kuhi123"),
    ("nagarpanchayat", "Mouda", "Nagpur", "mouda_ngp", "mouda123"),
    ("nagarpanchayat", "Parseoni", "Nagpur", "parseoni_ngp", "parseoni123"),
    ("nagarpanchayat", "Lakhandur", "Bhandara", "lakhandur_ngp", "lakhandur123"),
    ("nagarpanchayat", "Lakhani", "Bhandara", "lakhani_ngp", "lakhani123"),
    ("grampanchayat", "Agadgaon", "Ahilyanagar", "agadgaon_gp", "agadgaon123"),
    ("grampanchayat", "Akolner", "Ahilyanagar", "akolner_gp", "akolner123"),
    ("grampanchayat", "Ambilwadi", "Ahilyanagar", "ambilwadi_gp", "ambilwadi123"),
    ("grampanchayat", "Arangaon", "Ahilyanagar", "arangaon_gp", "arangaon123"),
    ("grampanchayat", "Bahirwadi", "Ahilyanagar", "bahirwadi_gp", "bahirwadi123"),
    ("grampanchayat", "Bardari", "Ahilyanagar", "bardari_gp", "bardari123"),
    ("grampanchayat", "Bhatodi Pargaon", "Ahilyanagar", "bhatodipargaon_gp", "bhatodi123"),
    ("grampanchayat", "Bhorwadi", "Ahilyanagar", "bhorwadi_gp", "bhorwadi123"),
    ("grampanchayat", "Burhannagar", "Ahilyanagar", "burhannagar_gp", "burhan123"),
    ("grampanchayat", "Chas", "Ahilyanagar", "chas_gp", "chas123"),
]

LOCAL_BODY_COORDINATES = {
    "mumbai_mnp": (19.0760, 72.8777), "pune_mnp": (18.5204, 73.8567),
    "nagpur_mnp": (21.1458, 79.0882), "thane_mnp": (19.2183, 72.9781),
    "nashik_mnp": (19.9975, 73.7898), "pcmc_mnp": (18.6298, 73.7997),
    "sambhajinagar_mnp": (19.8762, 75.3433), "solapur_mnp": (17.6599, 75.9064),
    "kolhapur_mnp": (16.7050, 74.2433), "navimumbai_mnp": (19.0330, 73.0297),
    "baramati_np": (18.1517, 74.5777), "lonavala_np": (18.7546, 73.4062),
    "talegaon_np": (18.7351, 73.6750), "daund_np": (18.4652, 74.5838),
    "chakan_np": (18.7606, 73.8586), "shirur_np": (18.8276, 74.3748),
    "indapur_np": (18.1171, 75.0239), "saswad_np": (18.3435, 74.0315),
    "alandi_np": (18.6776, 73.8987), "alibag_np": (18.6414, 72.8722),
    "vadgaonmaval_ngp": (18.7481, 73.6410), "dehu_ngp": (18.7185, 73.7669),
    "manchar_ngp": (19.0022, 73.9438), "bhiwapur_ngp": (20.7642, 79.5027),
    "hingna_ngp": (21.0886, 78.9829), "kuhi_ngp": (21.0101, 79.3524),
    "mouda_ngp": (21.1454, 79.3971), "parseoni_ngp": (21.3884, 79.1446),
    "lakhandur_ngp": (20.7487, 79.8877), "lakhani_ngp": (21.0648, 79.8297),
    "agadgaon_gp": (19.0658, 74.8040), "akolner_gp": (19.0173, 74.6654),
    "ambilwadi_gp": (19.1000, 74.7900), "arangaon_gp": (19.0216, 74.6614),
    "bahirwadi_gp": (19.1690, 74.7430), "bardari_gp": (19.0900, 74.7600),
    "bhatodipargaon_gp": (19.0191, 74.7491), "bhorwadi_gp": (19.0650, 74.7300),
    "burhannagar_gp": (19.0946, 74.7754), "chas_gp": (19.1334, 74.8363),
}


class UserAuth(BaseModel):
    username: str
    password: str


class UserRegistration(BaseModel):
    username: str
    email: str
    password: str


class ComplaintStatusUpdate(BaseModel):
    status: str


class LocalBodyCreate(BaseModel):
    body_type: str
    state: str
    area_name: str
    district: str
    username: str
    password: str


class AdminEmailPayload(BaseModel):
    to_email: str
    subject: str
    body: str


def connect_db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with connect_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(80) NOT NULL UNIQUE,
                email VARCHAR(120) NOT NULL UNIQUE,
                password VARCHAR(80) NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS local_body_logins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                body_type VARCHAR(40) NOT NULL,
                state VARCHAR(80),
                area_name VARCHAR(120) NOT NULL,
                district VARCHAR(80) NOT NULL,
                username VARCHAR(80) NOT NULL UNIQUE,
                password VARCHAR(80) NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS complaints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title VARCHAR(120) NOT NULL,
                description TEXT NOT NULL,
                image_filename VARCHAR(255),
                latitude FLOAT,
                longitude FLOAT,
                address TEXT,
                user_id INTEGER,
                local_body_login_id INTEGER,
                department VARCHAR(80),
                priority VARCHAR(20),
                status VARCHAR(30) NOT NULL DEFAULT 'open',
                created_at DATETIME NOT NULL
            )
            """
        )
        _ensure_complaint_columns(db)
        _ensure_local_body_columns(db)
        db.executemany(
            """
            INSERT OR IGNORE INTO local_body_logins
            (body_type, state, area_name, district, username, password)
            VALUES (?, 'Maharashtra', ?, ?, ?, ?)
            """,
            LOCAL_BODY_LOGINS,
        )
        db.execute(
            "UPDATE local_body_logins SET state = 'Maharashtra' WHERE state IS NULL OR state = ''"
        )


def _ensure_complaint_columns(db):
    existing = {row["name"] for row in db.execute("PRAGMA table_info(complaints)").fetchall()}
    columns = {
        "image_filename": "VARCHAR(255)",
        "latitude": "FLOAT",
        "longitude": "FLOAT",
        "address": "TEXT",
        "user_id": "INTEGER",
        "local_body_login_id": "INTEGER",
        "department": "VARCHAR(80)",
        "priority": "VARCHAR(20)",
    }
    for name, definition in columns.items():
        if name not in existing:
            db.execute(f"ALTER TABLE complaints ADD COLUMN {name} {definition}")


def _ensure_local_body_columns(db):
    existing = {row["name"] for row in db.execute("PRAGMA table_info(local_body_logins)").fetchall()}
    if "state" not in existing:
        db.execute("ALTER TABLE local_body_logins ADD COLUMN state VARCHAR(80)")


init_db()


@app.post("/api/users/register")
def register_user(payload: UserRegistration):
    username = payload.username.strip()
    email = payload.email.strip()
    password = payload.password.strip()

    if not username or not email or not password:
        raise HTTPException(status_code=400, detail="Username, email, and password are required.")

    try:
        with connect_db() as db:
            cursor = db.execute(
                "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
                (username, email, password),
            )
            return {"id": cursor.lastrowid, "username": username, "email": email}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username or email already exists.")


@app.post("/api/users/login")
def login_user(payload: UserAuth):
    with connect_db() as db:
        user = db.execute(
            "SELECT id, username, email FROM users WHERE username = ? AND password = ?",
            (payload.username.strip(), payload.password.strip()),
        ).fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    return dict(user)


@app.post("/api/local-body/login")
def login_local_body(payload: UserAuth):
    with connect_db() as db:
        login = db.execute(
            """
            SELECT id, body_type, state, area_name, district, username
            FROM local_body_logins
            WHERE username = ? AND password = ?
            """,
            (payload.username.strip(), payload.password.strip()),
        ).fetchone()

    if not login:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    return dict(login)


@app.get("/api/local-body-logins")
def list_local_body_logins():
    with connect_db() as db:
        rows = db.execute(
            """
            SELECT id, body_type, state, area_name, district, username, password
            FROM local_body_logins
            ORDER BY body_type, state, area_name
            """
        ).fetchall()
    return [dict(row) for row in rows]


@app.post("/api/admin/login")
def login_admin(payload: UserAuth):
    if payload.username.strip() != "admin" or payload.password.strip() != "admin123":
        raise HTTPException(status_code=401, detail="Invalid admin username or password.")

    return {"username": "admin"}


@app.get("/api/local-body-types")
def list_local_body_types():
    return LOCAL_BODY_TYPES


@app.get("/api/states")
def list_states():
    return STATES


@app.post("/api/admin/local-bodies")
def create_local_body(payload: LocalBodyCreate):
    body_type = payload.body_type.strip()
    state = payload.state.strip()
    area_name = payload.area_name.strip()
    district = payload.district.strip()
    username = payload.username.strip()
    password = payload.password.strip()

    if body_type not in LOCAL_BODY_TYPES:
        raise HTTPException(status_code=400, detail="Invalid local body type.")
    if state not in STATES:
        raise HTTPException(status_code=400, detail="Invalid state.")
    if not area_name or not district or not username or not password:
        raise HTTPException(status_code=400, detail="All fields are required.")

    try:
        with connect_db() as db:
            cursor = db.execute(
                """
                INSERT INTO local_body_logins
                (body_type, state, area_name, district, username, password)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (body_type, state, area_name, district, username, password),
            )
            row = db.execute(
                """
                SELECT id, body_type, state, area_name, district, username, password
                FROM local_body_logins
                WHERE id = ?
                """,
                (cursor.lastrowid,),
            ).fetchone()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists.")

    return dict(row)


@app.post("/api/admin/send-email")
def send_admin_email(payload: AdminEmailPayload):
    return send_email(payload)


@app.post("/api/send-email")
def send_email(payload: AdminEmailPayload):
    to_email = payload.to_email.strip()
    subject = payload.subject.strip()
    body = payload.body.strip()

    if not to_email or "@" not in to_email:
        raise HTTPException(status_code=400, detail="Valid recipient email is required.")
    if not subject or not body:
        raise HTTPException(status_code=400, detail="Subject and body are required.")

    message = EmailMessage()
    message["From"] = SMTP_EMAIL
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
            smtp.starttls()
            smtp.login(SMTP_EMAIL, SMTP_APP_PASSWORD.replace(" ", ""))
            smtp.send_message(message)
    except smtplib.SMTPException as exc:
        raise HTTPException(status_code=502, detail=f"Email could not be sent: {exc}")

    return {"message": "Email sent successfully."}


@app.get("/api/departments")
def list_departments():
    return DEPARTMENTS


@app.get("/api/complaint-statuses")
def list_complaint_statuses():
    return COMPLAINT_STATUSES


@app.post("/api/images/location")
def image_location(image: UploadFile = File(...)):
    coordinates = extract_image_gps(image)
    if not coordinates:
        raise HTTPException(status_code=404, detail="No GPS latitude and longitude found in this image.")

    latitude, longitude = coordinates
    return {
        "latitude": latitude,
        "longitude": longitude,
        "address": reverse_geocode_address(latitude, longitude) or "",
    }


@app.post("/api/complaints")
def create_complaint(
    user_id: int = Form(...),
    username: str = Form(...),
    description: str = Form(...),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    address: str | None = Form(None),
    image: UploadFile | None = File(None),
):
    if not description.strip():
        raise HTTPException(status_code=400, detail="Description is required.")

    image_gps = extract_image_gps(image)
    if image_gps:
        latitude, longitude = image_gps
        location_source = "image"
    else:
        location_source = "live"

    if latitude is None or longitude is None:
        raise HTTPException(status_code=400, detail="GPS location is required.")

    clean_address = (address or "").strip()
    if not clean_address and location_source == "image":
        clean_address = reverse_geocode_address(latitude, longitude) or ""

    local_body = find_nearest_local_body(latitude, longitude)
    if not local_body:
        raise HTTPException(status_code=400, detail="No local body found for this location.")

    department = predict_department(description)
    image_filename = save_image(image)
    created_at = datetime.now(timezone.utc).isoformat()

    with connect_db() as db:
        cursor = db.execute(
            """
            INSERT INTO complaints
            (title, description, image_filename, latitude, longitude, address, user_id,
             local_body_login_id, department, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
            """,
            (
                f"Complaint from {username}",
                description.strip(),
                image_filename,
                latitude,
                longitude,
                clean_address,
                user_id,
                local_body["id"],
                department,
                created_at,
            ),
        )

    return {
        "id": cursor.lastrowid,
        "description": description,
        "latitude": latitude,
        "longitude": longitude,
        "address": clean_address,
        "image_filename": image_filename,
        "local_body": local_body,
        "department": department,
        "location_source": location_source,
    }


@app.get("/api/users/{user_id}/complaints")
def complaints_for_user(user_id: int):
    with connect_db() as db:
        rows = db.execute(
            """
            SELECT c.id, c.title, c.description, c.image_filename, c.latitude,
                   c.longitude, c.address, c.department, c.priority, c.status, c.created_at,
                   l.area_name AS local_body_area_name,
                   l.body_type AS local_body_type,
                   l.state AS local_body_state,
                   l.district AS local_body_district
            FROM complaints c
            LEFT JOIN local_body_logins l ON l.id = c.local_body_login_id
            WHERE c.user_id = ?
            ORDER BY c.created_at DESC
            """,
            (user_id,),
        ).fetchall()

    return [dict(row) for row in rows]


@app.get("/api/admin/complaints")
def complaints_for_admin():
    with connect_db() as db:
        rows = db.execute(
            """
            SELECT c.id, c.title, c.description, c.image_filename, c.latitude,
                   c.longitude, c.address, c.department, c.priority, c.status, c.created_at,
                   u.username AS user_username,
                   l.area_name AS local_body_area_name,
                   l.body_type AS local_body_type,
                   l.state AS local_body_state,
                   l.district AS local_body_district
            FROM complaints c
            LEFT JOIN users u ON u.id = c.user_id
            LEFT JOIN local_body_logins l ON l.id = c.local_body_login_id
            ORDER BY c.created_at DESC
            """
        ).fetchall()

    return [dict(row) for row in rows]


@app.get("/api/local-body/{local_body_id}/complaints")
def complaints_for_local_body(local_body_id: int):
    with connect_db() as db:
        rows = db.execute(
            """
            SELECT c.id, c.title, c.description, c.image_filename, c.latitude,
                   c.longitude, c.address, c.department, c.priority, c.status, c.created_at,
                   u.username AS user_username
            FROM complaints c
            LEFT JOIN users u ON u.id = c.user_id
            WHERE c.local_body_login_id = ?
            ORDER BY c.created_at DESC
            """,
            (local_body_id,),
        ).fetchall()
    return [dict(row) for row in rows]


@app.patch("/api/local-body/{local_body_id}/complaints/{complaint_id}/status")
def update_complaint_status(local_body_id: int, complaint_id: int, payload: ComplaintStatusUpdate):
    status = payload.status.strip().lower()
    if status not in COMPLAINT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid complaint status.")

    with connect_db() as db:
        cursor = db.execute(
            """
            UPDATE complaints
            SET status = ?
            WHERE id = ? AND local_body_login_id = ?
            """,
            (status, complaint_id, local_body_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Complaint not found.")

        row = db.execute(
            """
            SELECT c.id, c.title, c.description, c.image_filename, c.latitude,
                   c.longitude, c.address, c.department, c.priority, c.status, c.created_at,
                   u.username AS user_username
            FROM complaints c
            LEFT JOIN users u ON u.id = c.user_id
            WHERE c.id = ?
            """,
            (complaint_id,),
        ).fetchone()

    return dict(row)


@app.patch("/api/local-body/{local_body_id}/complaints/{complaint_id}/priority")
def check_complaint_priority(local_body_id: int, complaint_id: int):
    with connect_db() as db:
        complaint = db.execute(
            """
            SELECT id, description
            FROM complaints
            WHERE id = ? AND local_body_login_id = ?
            """,
            (complaint_id, local_body_id),
        ).fetchone()

        if not complaint:
            raise HTTPException(status_code=404, detail="Complaint not found.")

        priority = predict_priority(complaint["description"])
        db.execute(
            """
            UPDATE complaints
            SET priority = ?
            WHERE id = ? AND local_body_login_id = ?
            """,
            (priority, complaint_id, local_body_id),
        )

        row = db.execute(
            """
            SELECT c.id, c.title, c.description, c.image_filename, c.latitude,
                   c.longitude, c.address, c.department, c.priority, c.status, c.created_at,
                   u.username AS user_username
            FROM complaints c
            LEFT JOIN users u ON u.id = c.user_id
            WHERE c.id = ? AND c.local_body_login_id = ?
            """,
            (complaint_id, local_body_id),
        ).fetchone()

    return dict(row)


@app.get("/api/local-body/{local_body_id}/departments")
def departments_for_local_body(local_body_id: int):
    with connect_db() as db:
        rows = db.execute(
            """
            SELECT department, COUNT(*) AS complaint_count
            FROM complaints
            WHERE local_body_login_id = ? AND department IS NOT NULL
            GROUP BY department
            """,
            (local_body_id,),
        ).fetchall()

    counts = {row["department"]: row["complaint_count"] for row in rows}
    return [
        {"name": department, "complaint_count": counts.get(department, 0)}
        for department in DEPARTMENTS
    ]


@app.get("/api/local-body/{local_body_id}/departments/{department}/complaints")
def complaints_for_department(local_body_id: int, department: str):
    if department not in DEPARTMENTS:
        raise HTTPException(status_code=404, detail="Department not found.")

    with connect_db() as db:
        rows = db.execute(
            """
            SELECT c.id, c.title, c.description, c.image_filename, c.latitude,
                   c.longitude, c.address, c.department, c.priority, c.status, c.created_at,
                   u.username AS user_username
            FROM complaints c
            LEFT JOIN users u ON u.id = c.user_id
            WHERE c.local_body_login_id = ? AND c.department = ?
            ORDER BY c.created_at DESC
            """,
            (local_body_id, department),
        ).fetchall()

    return [dict(row) for row in rows]


def save_image(image):
    if not image or not image.filename:
        return None

    extension = os.path.splitext(image.filename)[1].lower()
    filename = f"{uuid4().hex}{extension}"
    target = UPLOAD_DIR / filename

    image.file.seek(0)
    with target.open("wb") as file:
        shutil.copyfileobj(image.file, file)

    return filename


def convert_to_degrees(value):
    degrees = float(value[0])
    minutes = float(value[1])
    seconds = float(value[2])
    return degrees + (minutes / 60.0) + (seconds / 3600.0)


def normalize_gps_ref(value):
    if isinstance(value, bytes):
        value = value.decode("ascii", errors="ignore")
    return str(value).strip().upper()


def extract_image_gps(image):
    if not image or not image.filename:
        return None

    try:
        from PIL import Image
        from PIL.ExifTags import GPSTAGS, TAGS

        image.file.seek(0)
        pil_image = Image.open(image.file)
        exif_data = pil_image._getexif()

        if not exif_data:
            return None

        gps_info = {}
        for tag, value in exif_data.items():
            tag_name = TAGS.get(tag, tag)
            if tag_name == "GPSInfo":
                for key in value.keys():
                    decoded = GPSTAGS.get(key, key)
                    gps_info[decoded] = value[key]

        required_keys = {"GPSLatitude", "GPSLatitudeRef", "GPSLongitude", "GPSLongitudeRef"}
        if not required_keys.issubset(gps_info):
            return None

        latitude = convert_to_degrees(gps_info["GPSLatitude"])
        if normalize_gps_ref(gps_info["GPSLatitudeRef"]) != "N":
            latitude = -latitude

        longitude = convert_to_degrees(gps_info["GPSLongitude"])
        if normalize_gps_ref(gps_info["GPSLongitudeRef"]) != "E":
            longitude = -longitude

        return latitude, longitude
    except Exception:
        return None
    finally:
        try:
            image.file.seek(0)
        except Exception:
            pass


def reverse_geocode_address(latitude, longitude):
    try:
        from geopy.geocoders import Nominatim

        geolocator = Nominatim(user_agent="image_location_finder", timeout=8)
        location = geolocator.reverse((latitude, longitude), language="en")
        return location.address if location else None
    except Exception:
        return None


def parse_jpeg_gps(data):
    offset = 2
    length = len(data)

    while offset + 4 <= length:
        if data[offset] != 0xFF:
            break

        marker = data[offset + 1]
        offset += 2

        if marker == 0xDA:
            break

        if offset + 2 > length:
            break

        segment_length = int.from_bytes(data[offset:offset + 2], "big")
        segment_start = offset + 2
        segment_end = offset + segment_length

        if marker == 0xE1 and data[segment_start:segment_start + 6] == b"Exif\x00\x00":
            return parse_tiff_gps(data[segment_start + 6:segment_end])

        offset = segment_end

    return None


def parse_tiff_gps(tiff):
    if len(tiff) < 8:
        return None

    byte_order = tiff[:2]
    if byte_order == b"II":
        endian = "little"
    elif byte_order == b"MM":
        endian = "big"
    else:
        return None

    def read_uint(position, size):
        if position < 0 or position + size > len(tiff):
            raise ValueError("Invalid TIFF offset")
        return int.from_bytes(tiff[position:position + size], endian)

    if read_uint(2, 2) != 42:
        return None

    gps_ifd_offset = None
    first_ifd_offset = read_uint(4, 4)
    for tag, value_type, count, value_offset in read_ifd_entries(tiff, first_ifd_offset, endian):
        if tag == 0x8825:
            gps_ifd_offset = value_offset
            break

    if gps_ifd_offset is None:
        return None

    gps_values = {}
    for tag, value_type, count, value_offset in read_ifd_entries(tiff, gps_ifd_offset, endian):
        gps_values[tag] = read_tiff_value(tiff, endian, value_type, count, value_offset)

    lat_ref = gps_values.get(1)
    lat_values = gps_values.get(2)
    lon_ref = gps_values.get(3)
    lon_values = gps_values.get(4)

    if not lat_ref or not lon_ref or not lat_values or not lon_values:
        return None

    latitude = gps_to_decimal(lat_values, lat_ref)
    longitude = gps_to_decimal(lon_values, lon_ref)

    if latitude is None or longitude is None:
        return None

    return latitude, longitude


def read_ifd_entries(tiff, ifd_offset, endian):
    if ifd_offset + 2 > len(tiff):
        return []

    count = int.from_bytes(tiff[ifd_offset:ifd_offset + 2], endian)
    entries = []
    for index in range(count):
        entry_offset = ifd_offset + 2 + index * 12
        if entry_offset + 12 > len(tiff):
            break

        tag = int.from_bytes(tiff[entry_offset:entry_offset + 2], endian)
        value_type = int.from_bytes(tiff[entry_offset + 2:entry_offset + 4], endian)
        value_count = int.from_bytes(tiff[entry_offset + 4:entry_offset + 8], endian)
        value_offset = int.from_bytes(tiff[entry_offset + 8:entry_offset + 12], endian)
        entries.append((tag, value_type, value_count, value_offset))

    return entries


def read_tiff_value(tiff, endian, value_type, count, value_offset):
    type_sizes = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8}
    size = type_sizes.get(value_type, 1) * count
    raw = value_offset.to_bytes(4, endian)[:size] if size <= 4 else tiff[value_offset:value_offset + size]

    if value_type == 2:
        return raw.split(b"\x00", 1)[0].decode("ascii", errors="ignore")
    if value_type == 5:
        values = []
        for index in range(count):
            start = index * 8
            numerator = int.from_bytes(raw[start:start + 4], endian)
            denominator = int.from_bytes(raw[start + 4:start + 8], endian)
            values.append(numerator / denominator if denominator else 0)
        return values

    return None


def gps_to_decimal(values, ref):
    if len(values) < 3:
        return None

    decimal = values[0] + values[1] / 60 + values[2] / 3600
    if ref.upper() in {"S", "W"}:
        decimal *= -1
    return decimal


def extract_printed_gps(data):
    try:
        from PIL import Image
        import numpy as np

        image = Image.open(BytesIO(data)).convert("RGB")
        width, height = image.size
        lower_image = image.crop((0, int(height * 0.55), width, height))

        text_parts = load_ocr_reader().readtext(np.array(lower_image), detail=0, paragraph=True)
        text = " ".join(text_parts)
        return parse_printed_gps_text(text)
    except Exception:
        return None


@lru_cache(maxsize=1)
def load_ocr_reader():
    import easyocr

    return easyocr.Reader(["en"], gpu=False, download_enabled=False)


def parse_printed_gps_text(text):
    if not text:
        return None

    normalized = text.replace(",", " ")
    normalized = normalized.replace("°", " ")
    normalized = re.sub(r"\s+", " ", normalized)
    patterns = [
        r"\bLat(?:itude)?\D*(-?\d{1,2}(?:\.\d+)?)\D*(?:Long|Lon|Lng|Longitude)\D*(-?\d{1,3}(?:\.\d+)?)",
        r"\b(?:Long|Lon|Lng|Longitude)\D*(-?\d{1,3}(?:\.\d+)?)\D*Lat(?:itude)?\D*(-?\d{1,2}(?:\.\d+)?)",
    ]

    for index, pattern in enumerate(patterns):
        match = re.search(pattern, normalized, flags=re.IGNORECASE)
        if not match:
            continue

        first = float(match.group(1))
        second = float(match.group(2))
        latitude, longitude = (first, second) if index == 0 else (second, first)
        if -90 <= latitude <= 90 and -180 <= longitude <= 180:
            return latitude, longitude

    return None


def find_nearest_local_body(latitude, longitude):
    with connect_db() as db:
        logins = db.execute(
            "SELECT id, body_type, state, area_name, district, username FROM local_body_logins"
        ).fetchall()

    nearest = None
    nearest_distance = None

    for login in logins:
        coordinates = LOCAL_BODY_COORDINATES.get(login["username"])
        if not coordinates:
            continue

        distance = distance_km(latitude, longitude, coordinates[0], coordinates[1])
        if nearest_distance is None or distance < nearest_distance:
            nearest_distance = distance
            nearest = dict(login)

    return nearest


def distance_km(lat1, lon1, lat2, lon2):
    earth_radius_km = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    latitude_delta = lat2 - lat1
    longitude_delta = lon2 - lon1
    haversine = (
        sin(latitude_delta / 2) ** 2
        + cos(lat1) * cos(lat2) * sin(longitude_delta / 2) ** 2
    )
    return 2 * earth_radius_km * asin(sqrt(haversine))


@lru_cache(maxsize=1)
def load_department_classifier():
    from tensorflow.keras.models import load_model
    from tensorflow.keras.preprocessing.sequence import pad_sequences

    missing_files = [
        path.name
        for path in (MODEL_PATH, TOKENIZER_PATH, LABEL_ENCODER_PATH)
        if not path.exists()
    ]
    if missing_files:
        raise HTTPException(
            status_code=500,
            detail=f"Department model files are missing: {', '.join(missing_files)}",
        )

    model = load_model(MODEL_PATH, compile=False)
    with TOKENIZER_PATH.open("rb") as file:
        tokenizer = pickle.load(file)
    with LABEL_ENCODER_PATH.open("rb") as file:
        label_encoder = pickle.load(file)

    return model, tokenizer, label_encoder, pad_sequences


def predict_department(description):
    model, tokenizer, label_encoder, pad_sequences = load_department_classifier()
    cleaned = clean_text(description)
    sequence = tokenizer.texts_to_sequences([cleaned])
    padded = pad_sequences(sequence, maxlen=MAX_LEN, padding="post")
    prediction = model.predict(padded, verbose=0)
    label_index = int(prediction.argmax(axis=1)[0])

    if label_index >= len(label_encoder.classes_):
        raise HTTPException(status_code=500, detail="Model returned an unknown department.")

    return str(label_encoder.inverse_transform([label_index])[0])


@lru_cache(maxsize=1)
def load_priority_classifier():
    if not PRIORITY_MODEL_PATH.exists():
        raise HTTPException(status_code=500, detail="Priority model file is missing.")

    import joblib

    return joblib.load(PRIORITY_MODEL_PATH)


def predict_priority(description):
    model = load_priority_classifier()
    prediction = model.predict([description.strip()])[0]
    return str(prediction).strip().title()


def clean_text(text):
    text = text.lower()
    text = re.sub(r"\[.*?\]", "", text)
    text = re.sub(r"https?://\S+|www\.\S+", "", text)
    text = re.sub(r"<.*?>+", "", text)
    text = re.sub(r"[%s]" % re.escape(string.punctuation), "", text)
    text = re.sub(r"\n", " ", text)
    text = re.sub(r"\w*\d\w*", "", text)
    return text


@app.get("/")
def api_home():
    return {"message": "Complaint App FastAPI backend is running."}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
