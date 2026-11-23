import { useEffect, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const COMPLAINT_STATUSES = ["open", "work in progress", "closed"];
const DEFAULT_LOCAL_BODY_TYPES = ["mahanagarpalika", "nagarpalika", "nagarpanchayat", "grampanchayat"];
const DEFAULT_STATES = ["Maharashtra"];
const STATUS_COLORS = {
  open: "#dc2626",
  "work in progress": "#eab308",
  closed: "#16a34a",
};

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Request failed.");
  }

  return data;
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [localBody, setLocalBody] = useState(() => JSON.parse(localStorage.getItem("localBody") || "null"));
  const [admin, setAdmin] = useState(() => JSON.parse(localStorage.getItem("admin") || "null"));

  function navigate(nextPath) {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
  }

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function logout() {
    localStorage.removeItem("user");
    localStorage.removeItem("localBody");
    localStorage.removeItem("admin");
    setUser(null);
    setLocalBody(null);
    setAdmin(null);
    navigate("/");
  }

  let page = <Home navigate={navigate} />;

  if (path === "/user/login") {
    page = <UserLogin setUser={setUser} navigate={navigate} />;
  }

  if (path === "/user/registraiton" || path === "/user/registration") {
    page = <UserRegistration setUser={setUser} navigate={navigate} />;
  }

  if (path === "/user/dashboard") {
    page = user ? <UserDashboard user={user} /> : <UserLogin setUser={setUser} navigate={navigate} />;
  }

  if (path === "/login") {
    page = <LocalBodyLogin setLocalBody={setLocalBody} navigate={navigate} />;
  }

  if (path === "/admin/login") {
    page = <AdminLogin setAdmin={setAdmin} navigate={navigate} />;
  }

  if (path === "/admin/dashboard") {
    page = admin ? <AdminDashboard navigate={navigate} /> : <AdminLogin setAdmin={setAdmin} navigate={navigate} />;
  }

  if (path === "/dashboard") {
    page = localBody ? <LocalBodyDashboard localBody={localBody} /> : <LocalBodyLogin setLocalBody={setLocalBody} navigate={navigate} />;
  }

  if (path === "/logins") {
    page = <SeedLogins />;
  }

  return (
    <>
      <header className="topbar">
        <nav className="topnav">
          <NavLink href="/user/login" navigate={navigate}>User Login</NavLink>
          <NavLink href="/user/registraiton" navigate={navigate}>User Registration</NavLink>
          {user && <NavLink href="/user/dashboard" navigate={navigate}>User Dashboard</NavLink>}
          {localBody && <NavLink href="/dashboard" navigate={navigate}>Local Dashboard</NavLink>}
          {admin && <NavLink href="/admin/dashboard" navigate={navigate}>Admin Dashboard</NavLink>}
          {(user || localBody || admin) && <span className="nav-badge">{user?.username || localBody?.area_name || admin?.username}</span>}
          {(user || localBody || admin) && <button className="nav-logout" onClick={logout}>Logout</button>}
        </nav>
      </header>
      <main className="app-shell">{page}</main>
    </>
  );
}

function NavLink({ href, navigate, children }) {
  return (
    <a href={href} onClick={(event) => {
      event.preventDefault();
      navigate(href);
    }}>
      {children}
    </a>
  );
}

function Home({ navigate }) {
  return (
    <section className="panel hero-panel">
      <h1>Complaint App</h1>
      <p>Smart complaint routing, live GPS capture, interactive maps, and focused dashboards for users, local bodies, and admin teams.</p>
      <div className="actions hero-actions">
        <button onClick={() => navigate("/user/login")}>User Login</button>
        <button onClick={() => navigate("/login")}>Local Body Login</button>
        <button onClick={() => navigate("/admin/login")}>Admin Login</button>
      </div>
    </section>
  );
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] || "Unknown";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function BarChart({ title, data, onSelect }) {
  const entries = Object.entries(data).filter(([, value]) => value > 0);
  const maxValue = Math.max(...entries.map(([, value]) => value), 1);

  return (
    <div className="chart-card">
      <h3>{title}</h3>
      {entries.length === 0 && <p className="muted">No data yet.</p>}
      <div className="bar-chart">
        {entries.map(([label, value]) => (
          <button
            className="bar-row"
            key={label}
            type="button"
            onClick={() => onSelect?.(label)}
          >
            <span>{label}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(value / maxValue) * 100}%` }} />
            </div>
            <strong>{value}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getStatusColor(status) {
  return STATUS_COLORS[status] || "#0f766e";
}

function getPriorityClass(priority) {
  return `priority-${String(priority || "unknown").toLowerCase()}`;
}

function hasGpsCoordinates(complaint) {
  return Number.isFinite(Number(complaint.latitude)) && Number.isFinite(Number(complaint.longitude));
}

function ComplaintMap({ complaints, height = 420 }) {
  const mappedComplaints = complaints.filter(hasGpsCoordinates);
  const center = mappedComplaints.length
    ? [Number(mappedComplaints[0].latitude), Number(mappedComplaints[0].longitude)]
    : [20.5937, 78.9629];

  return (
    <div className="complaint-map-shell" style={{ height }}>
      <MapContainer center={center} zoom={mappedComplaints.length === 1 ? 16 : 6} scrollWheelZoom className="complaint-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mappedComplaints.map((complaint) => (
          <CircleMarker
            key={complaint.id}
            center={[Number(complaint.latitude), Number(complaint.longitude)]}
            pathOptions={{
              color: getStatusColor(complaint.status),
              fillColor: getStatusColor(complaint.status),
              fillOpacity: 0.9,
              weight: 2,
            }}
            radius={10}
          >
            <Popup>
              <strong>{complaint.title}</strong>
              <div>{complaint.status}</div>
              {complaint.department && <div>{complaint.department}</div>}
              {complaint.local_body_area_name && (
                <div>{complaint.local_body_area_name}, {complaint.local_body_district}</div>
              )}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="map-legend">
        <span><i className="legend-dot legend-open" />Open</span>
        <span><i className="legend-dot legend-progress" />Work in progress</span>
        <span><i className="legend-dot legend-closed" />Closed</span>
      </div>
    </div>
  );
}

function readAscii(dataView, start, length) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    const code = dataView.getUint8(start + index);
    if (code === 0) break;
    value += String.fromCharCode(code);
  }
  return value;
}

function readExifValue(dataView, tiffStart, entryOffset, littleEndian) {
  const type = dataView.getUint16(entryOffset + 2, littleEndian);
  const count = dataView.getUint32(entryOffset + 4, littleEndian);
  const valueOffset = dataView.getUint32(entryOffset + 8, littleEndian);
  const typeSizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 };
  const size = (typeSizes[type] || 1) * count;
  const valueStart = size <= 4 ? entryOffset + 8 : tiffStart + valueOffset;

  if (valueStart < 0 || valueStart + size > dataView.byteLength) return null;

  if (type === 2) {
    return readAscii(dataView, valueStart, count);
  }

  if (type === 5) {
    const values = [];
    for (let index = 0; index < count; index += 1) {
      const itemStart = valueStart + index * 8;
      const numerator = dataView.getUint32(itemStart, littleEndian);
      const denominator = dataView.getUint32(itemStart + 4, littleEndian);
      values.push(denominator ? numerator / denominator : 0);
    }
    return values;
  }

  if (type === 4 && count === 1) return valueOffset;
  return null;
}

function readIfdEntries(dataView, tiffStart, ifdOffset, littleEndian) {
  const absoluteOffset = tiffStart + ifdOffset;
  if (absoluteOffset + 2 > dataView.byteLength) return [];

  const count = dataView.getUint16(absoluteOffset, littleEndian);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const entryOffset = absoluteOffset + 2 + index * 12;
    if (entryOffset + 12 > dataView.byteLength) break;

    entries.push({
      tag: dataView.getUint16(entryOffset, littleEndian),
      value: readExifValue(dataView, tiffStart, entryOffset, littleEndian),
    });
  }
  return entries;
}

function gpsToDecimal(values, ref) {
  if (!Array.isArray(values) || values.length < 3 || !ref) return null;

  const decimal = values[0] + values[1] / 60 + values[2] / 3600;
  return ["S", "W"].includes(ref.toUpperCase()) ? decimal * -1 : decimal;
}

function parseExifGps(arrayBuffer) {
  const dataView = new DataView(arrayBuffer);
  if (dataView.byteLength < 4 || dataView.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 <= dataView.byteLength) {
    if (dataView.getUint8(offset) !== 0xff) break;

    const marker = dataView.getUint8(offset + 1);
    const segmentLength = dataView.getUint16(offset + 2);
    const segmentStart = offset + 4;

    if (marker === 0xe1 && readAscii(dataView, segmentStart, 6) === "Exif") {
      const tiffStart = segmentStart + 6;
      const byteOrder = readAscii(dataView, tiffStart, 2);
      const littleEndian = byteOrder === "II";
      if (!littleEndian && byteOrder !== "MM") return null;
      if (dataView.getUint16(tiffStart + 2, littleEndian) !== 42) return null;

      const firstIfdOffset = dataView.getUint32(tiffStart + 4, littleEndian);
      const gpsPointer = readIfdEntries(dataView, tiffStart, firstIfdOffset, littleEndian)
        .find((entry) => entry.tag === 0x8825)?.value;
      if (!gpsPointer) return null;

      const gpsEntries = readIfdEntries(dataView, tiffStart, gpsPointer, littleEndian);
      const gps = Object.fromEntries(gpsEntries.map((entry) => [entry.tag, entry.value]));
      const latitude = gpsToDecimal(gps[2], gps[1]);
      const longitude = gpsToDecimal(gps[4], gps[3]);

      return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
    }

    offset += 2 + segmentLength;
  }

  return null;
}

async function getImageGps(file) {
  if (!file || !file.type?.startsWith("image/")) return null;
  return parseExifGps(await file.arrayBuffer());
}

function UserRegistration({ setUser, navigate }) {
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");

    try {
      const form = new FormData(event.currentTarget);
      const data = await apiJson("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      localStorage.setItem("user", JSON.stringify(data));
      setUser(data);
      navigate("/user/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="auth-screen">
      <h1>User Registration</h1>
      {error && <p className="error">{error}</p>}
      <form className="auth-form" onSubmit={submit}>
        <label>Username<input name="username" required /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>Password<input name="password" type="password" required /></label>
        <button>Register</button>
      </form>
    </section>
  );
}

function UserLogin({ setUser, navigate }) {
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");

    try {
      const form = new FormData(event.currentTarget);
      const data = await apiJson("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      localStorage.setItem("user", JSON.stringify(data));
      setUser(data);
      navigate("/user/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="auth-screen">
      <h1>User Login</h1>
      {error && <p className="error">{error}</p>}
      <form className="auth-form" onSubmit={submit}>
        <label>Username<input name="username" required /></label>
        <label>Password<input name="password" type="password" required /></label>
        <button>Login</button>
      </form>
    </section>
  );
}

function UserDashboard({ user }) {
  const [gps, setGps] = useState(null);
  const [gpsMessage, setGpsMessage] = useState("Getting live GPS location...");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploadImage, setUploadImage] = useState(null);
  const [imageGps, setImageGps] = useState(null);
  const [imageGpsMessage, setImageGpsMessage] = useState("");
  const [imageLocationLoading, setImageLocationLoading] = useState(false);
  const [address, setAddress] = useState("");

  async function loadComplaints() {
    const data = await apiJson(`/api/users/${user.id}/complaints`);
    setComplaints(data);
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsMessage("GPS location is not supported on this device.");
      return undefined;
    }

    const options = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextGps = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setGps(nextGps);
        setGpsMessage(`Live GPS captured: ${nextGps.latitude}, ${nextGps.longitude}`);
      },
      () => setGpsMessage("Please allow GPS location to submit the complaint."),
      options
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    loadComplaints().catch((err) => setError(err.message));
  }, [user.id]);

  async function checkUploadedImageLocation() {
    setError("");
    setImageGps(null);
    setAddress("");

    if (!uploadImage) {
      setImageGpsMessage("Please select an image first.");
      return;
    }

    setImageLocationLoading(true);
    setImageGpsMessage("Checking image GPS...");

    try {
      const payload = new FormData();
      payload.append("image", uploadImage);
      const response = await fetch(`${API_BASE}/api/images/location`, { method: "POST", body: payload });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not read image location.");

      const nextImageGps = { latitude: data.latitude, longitude: data.longitude };
      setImageGps(nextImageGps);
      setAddress(data.address || "");
      setImageGpsMessage("Image GPS found. Latitude and longitude are locked for this upload.");
    } catch (err) {
      setImageGpsMessage(`${err.message} Live GPS will be used when you submit.`);
    } finally {
      setImageLocationLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    setResult(null);
    setSubmitting(true);

    try {
      const form = new FormData(formElement);
      const uploadedImage = form.get("image");
      const image = capturedImage?.file || uploadImage || (uploadedImage?.size ? uploadedImage : null);
      const selectedGps = imageGps || gps;

      if (!selectedGps) {
        throw new Error("No GPS found in the image and live GPS is not captured yet.");
      }

      const payload = new FormData();
      payload.append("user_id", user.id);
      payload.append("username", user.username);
      payload.append("description", form.get("description"));
      payload.append("latitude", selectedGps.latitude);
      payload.append("longitude", selectedGps.longitude);
      payload.append("address", imageGps ? address : "");
      if (image && image.size) payload.append("image", image);

      const response = await fetch(`${API_BASE}/api/complaints`, { method: "POST", body: payload });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Complaint submission failed.");

      setResult(data);
      formElement.reset();
      if (capturedImage?.url) URL.revokeObjectURL(capturedImage.url);
      setCapturedImage(null);
      setUploadImage(null);
      setImageGps(null);
      setImageGpsMessage("");
      setAddress("");
      if (gps) {
        setGpsMessage(`Live GPS captured: ${gps.latitude}, ${gps.longitude}`);
      }
      await loadComplaints();
    } catch (err) {
      setError(err.message || "Please allow GPS and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="dashboard-page">
      <div className="panel">
        <h1>User Dashboard</h1>
        <p>Username: {user.username}</p>
      </div>

      {error && <p className="error">{error}</p>}
      {result && (
        <div className="panel">
          <p className="success">Complaint submitted.</p>
          <p>Sent to: {result.local_body.area_name} {result.local_body.body_type}, {result.local_body.district}</p>
          <p>Department: {result.department}</p>
          <p>Captured GPS: {result.latitude}, {result.longitude}</p>
          {result.address && <p>Address: {result.address}</p>}
          <p>GPS taken from: {result.location_source === "image" ? "Uploaded image" : "Live location"}</p>
        </div>
      )}

      <form onSubmit={submit}>
        <label>Description<textarea name="description" rows="5" required /></label>
        <label>
          Upload image
          <input
            name="image"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setUploadImage(file || null);
              setImageGps(null);
              setImageGpsMessage("");
              setAddress("");
              if (file) setImageGpsMessage("Click Show Image Location to read latitude, longitude, and address from the image.");
            }}
          />
        </label>
        <button
          className="secondary-button"
          type="button"
          disabled={!uploadImage || imageLocationLoading}
          onClick={checkUploadedImageLocation}
        >
          {imageLocationLoading ? "Checking Location..." : "Show Image Location"}
        </button>
        {imageGps && (
          <div className="image-location-box">
            <div className="locked-gps-grid">
              <label>
                Latitude
                <input value={imageGps.latitude} readOnly />
              </label>
              <label>
                Longitude
                <input value={imageGps.longitude} readOnly />
              </label>
            </div>
            <label>
              Address
              <textarea
                rows="3"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Address not found. You can type the address here."
              />
            </label>
          </div>
        )}
        <div className="camera-field">
          <span>Take picture from camera</span>
          <button type="button" onClick={() => setCameraOpen(true)}>Open Camera</button>
          {capturedImage && (
            <div className="capture-preview">
              <img src={capturedImage.url} alt="Captured complaint" />
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(capturedImage.url);
                  setCapturedImage(null);
                }}
              >
                Remove Captured Image
              </button>
            </div>
          )}
        </div>
        {imageGpsMessage && <p className="hint">{imageGpsMessage}</p>}
        <p className="hint">{gpsMessage}</p>
        <button disabled={submitting || (!gps && !imageGps)}>{submitting ? "Submitting..." : "Submit Complaint"}</button>
      </form>

      {cameraOpen && (
        <CameraCaptureModal
          onClose={() => setCameraOpen(false)}
          onUseImage={(image) => {
            if (capturedImage?.url) URL.revokeObjectURL(capturedImage.url);
            setCapturedImage(image);
            setImageGps(null);
            setAddress("");
            setImageGpsMessage("Camera image will use live GPS when you submit.");
            setCameraOpen(false);
          }}
        />
      )}

      <div className="panel">
        <h2>Your Complaints</h2>
        {complaints.length === 0 && <p>No complaints submitted yet.</p>}
        {complaints.map((complaint) => (
          <article className="complaint" key={complaint.id}>
            <h3>{complaint.title}</h3>
            <p>{complaint.description}</p>
            {complaint.image_filename && <img src={`${API_BASE}/uploads/${complaint.image_filename}`} alt="Complaint" />}
            <p className="muted">Sent to: {complaint.local_body_area_name} {complaint.local_body_type}, {complaint.local_body_district}, {complaint.local_body_state || "Maharashtra"}</p>
            <p className="muted">Department: {complaint.department}</p>
            <p className="muted">GPS: {complaint.latitude}, {complaint.longitude}</p>
            {complaint.address && <p className="muted">Address: {complaint.address}</p>}
            <p className={`status-pill status-${complaint.status.replaceAll(" ", "-")}`}>Status: {complaint.status}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CameraCaptureModal({ onClose, onUseImage }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const capturedUrlRef = useRef("");
  const [error, setError] = useState("");
  const [capturedUrl, setCapturedUrl] = useState("");
  const [capturedBlob, setCapturedBlob] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function openCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is not supported in this browser.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError(err.message || "Unable to open camera.");
      }
    }

    openCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current);
    };
  }, []);

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) {
        setError("Could not capture image. Please try again.");
        return;
      }

      if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current);
      const nextUrl = URL.createObjectURL(blob);
      capturedUrlRef.current = nextUrl;
      setCapturedBlob(blob);
      setCapturedUrl(nextUrl);
    }, "image/jpeg", 0.9);
  }

  function retakePhoto() {
    if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current);
    capturedUrlRef.current = "";
    setCapturedUrl("");
    setCapturedBlob(null);
  }

  function usePhoto() {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
    onUseImage({ file, url: URL.createObjectURL(capturedBlob) });
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="camera-title">
      <div className="map-modal camera-modal">
        <div className="modal-header">
          <div>
            <h2 id="camera-title">Take Picture</h2>
            <p className="muted">Capture a complaint photo from the device camera.</p>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Close camera">x</button>
        </div>
        {error && <p className="error camera-error">{error}</p>}
        <div className="camera-stage">
          {capturedUrl ? (
            <img className="camera-preview" src={capturedUrl} alt="Captured preview" />
          ) : (
            <video className="camera-video" ref={videoRef} autoPlay playsInline muted />
          )}
          <canvas ref={canvasRef} hidden />
        </div>
        <div className="camera-actions">
          {capturedUrl ? (
            <>
              <button type="button" onClick={retakePhoto}>Retake</button>
              <button type="button" onClick={usePhoto}>Use Photo</button>
            </>
          ) : (
            <button type="button" onClick={capturePhoto} disabled={!!error}>Capture</button>
          )}
        </div>
      </div>
    </div>
  );
}

function LocalBodyLogin({ setLocalBody, navigate }) {
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");

    try {
      const form = new FormData(event.currentTarget);
      const data = await apiJson("/api/local-body/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      localStorage.setItem("localBody", JSON.stringify(data));
      setLocalBody(data);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="auth-screen">
      <h1>Local Body Login</h1>
      {error && <p className="error">{error}</p>}
      <form className="auth-form" onSubmit={submit}>
        <label>Username<input name="username" required /></label>
        <label>Password<input name="password" type="password" required /></label>
        <button>Login</button>
      </form>
    </section>
  );
}

function AdminLogin({ setAdmin, navigate }) {
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");

    try {
      const form = new FormData(event.currentTarget);
      const data = await apiJson("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      localStorage.setItem("admin", JSON.stringify(data));
      setAdmin(data);
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="auth-screen">
      <h1>Admin Login</h1>
      {error && <p className="error">{error}</p>}
      <form className="auth-form" onSubmit={submit}>
        <label>Username<input name="username" required /></label>
        <label>Password<input name="password" type="password" required /></label>
        <button>Login</button>
      </form>
    </section>
  );
}

function AdminDashboard({ navigate }) {
  const [types, setTypes] = useState(DEFAULT_LOCAL_BODY_TYPES);
  const [states, setStates] = useState(DEFAULT_STATES);
  const [localBodies, setLocalBodies] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [createdLocalBody, setCreatedLocalBody] = useState(null);
  const [error, setError] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  async function loadLocalBodies() {
    const data = await apiJson("/api/local-body-logins");
    setLocalBodies(data);
  }

  async function loadComplaints() {
    const data = await apiJson("/api/admin/complaints");
    setComplaints(data);
  }

  useEffect(() => {
    apiJson("/api/local-body-types").then(setTypes).catch(() => setTypes(DEFAULT_LOCAL_BODY_TYPES));
    apiJson("/api/states").then(setStates).catch(() => setStates(DEFAULT_STATES));
    loadLocalBodies().catch((err) => setError(err.message));
    loadComplaints().catch((err) => setError(err.message));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setCreatedLocalBody(null);

    try {
      const form = new FormData(event.currentTarget);
      const data = await apiJson("/api/admin/local-bodies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      setCreatedLocalBody(data);
      await loadLocalBodies();
      event.currentTarget.reset();
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendEmail(event) {
    event.preventDefault();
    setEmailStatus("");
    setEmailError("");
    setSendingEmail(true);

    try {
      const form = new FormData(event.currentTarget);
      const data = await apiJson("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      setEmailStatus(data.message);
      event.currentTarget.reset();
    } catch (err) {
      setEmailError(err.message);
    } finally {
      setSendingEmail(false);
    }
  }

  const typeCounts = countBy(localBodies, "body_type");
  const stateCounts = countBy(localBodies, "state");
  const districtCounts = countBy(localBodies, "district");

  return (
    <section className="dashboard-page">
      <div className="panel">
        <h1>Admin Dashboard</h1>
        <p>Add new local body login credentials and review coverage.</p>
        <div className="actions">
          <button type="button" onClick={() => navigate("/logins")}>View Seed Logins</button>
          <button type="button" onClick={() => setMapOpen(true)}>View Complaint Map</button>
        </div>
      </div>

      <section className="stat-grid">
        <StatCard label="Local bodies" value={localBodies.length} />
        <StatCard label="States covered" value={Object.keys(stateCounts).length} />
        <StatCard label="Districts covered" value={Object.keys(districtCounts).length} />
        <StatCard label="Total complaints" value={complaints.length} />
      </section>

      <section className="chart-grid">
        <BarChart title="Local Bodies by Type" data={typeCounts} />
        <BarChart title="Local Bodies by State" data={stateCounts} />
      </section>

      {error && <p className="error">{error}</p>}
      {createdLocalBody && (
        <div className="panel">
          <p className="success">Local body added.</p>
          <p>{createdLocalBody.area_name}, {createdLocalBody.district}, {createdLocalBody.state}</p>
          <p>Username: {createdLocalBody.username}</p>
        </div>
      )}

      <form onSubmit={submit}>
        <label>
          Type
          <select name="body_type" required>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label>
          State
          <select name="state" defaultValue="Maharashtra" required>
            {states.map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
        </label>
        <label>Area<input name="area_name" required /></label>
        <label>District<input name="district" required /></label>
        <label>Username<input name="username" required /></label>
        <label>Password<input name="password" required /></label>
        <button>Add Local Body</button>
      </form>

      <div className="panel">
        <h2>Send Email</h2>
        {emailStatus && <p className="success">{emailStatus}</p>}
        {emailError && <p className="error">{emailError}</p>}
        <form className="nested-form" onSubmit={sendEmail}>
          <label>To Email<input name="to_email" type="email" required /></label>
          <label>Subject<input name="subject" required /></label>
          <label>Body<textarea name="body" rows="6" required /></label>
          <button disabled={sendingEmail}>{sendingEmail ? "Sending..." : "Send Email"}</button>
        </form>
      </div>

      {mapOpen && (
        <ComplaintMapModal
          title="All Complaint Locations"
          subtitle="Every complaint with status color coding."
          complaints={complaints}
          onClose={() => setMapOpen(false)}
        />
      )}
    </section>
  );
}

function LocalBodyDashboard({ localBody }) {
  const [departments, setDepartments] = useState([]);
  const [allComplaints, setAllComplaints] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [mapComplaint, setMapComplaint] = useState(null);
  const [allMapOpen, setAllMapOpen] = useState(false);
  const [statusDrafts, setStatusDrafts] = useState({});
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [checkingPriorityId, setCheckingPriorityId] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  async function loadAllComplaints() {
    const data = await apiJson(`/api/local-body/${localBody.id}/complaints`);
    setAllComplaints(data);
  }

  useEffect(() => {
    apiJson(`/api/local-body/${localBody.id}/departments`).then(setDepartments);
    loadAllComplaints().catch((err) => setStatusMessage(err.message));
  }, [localBody.id]);

  async function openDepartment(department) {
    setSelectedDepartment(department);
    setStatusMessage("");
    const data = await apiJson(
      `/api/local-body/${localBody.id}/departments/${encodeURIComponent(department)}/complaints`
    );
    setComplaints(data);
    setStatusDrafts(Object.fromEntries(data.map((complaint) => [complaint.id, complaint.status])));
  }

  function hasGps(complaint) {
    return hasGpsCoordinates(complaint);
  }

  async function updateStatus(complaint) {
    const nextStatus = statusDrafts[complaint.id] || complaint.status;
    setUpdatingStatusId(complaint.id);
    setStatusMessage("");

    try {
      const updatedComplaint = await apiJson(
        `/api/local-body/${localBody.id}/complaints/${complaint.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      setComplaints((current) =>
        current.map((item) => (item.id === updatedComplaint.id ? updatedComplaint : item))
      );
      setAllComplaints((current) =>
        current.map((item) => (item.id === updatedComplaint.id ? updatedComplaint : item))
      );
      setDepartments((current) => [...current]);
      setStatusDrafts((current) => ({ ...current, [updatedComplaint.id]: updatedComplaint.status }));
      setStatusMessage("Complaint status updated.");
    } catch (err) {
      setStatusMessage(err.message);
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function checkPriority(complaint) {
    setCheckingPriorityId(complaint.id);
    setStatusMessage("");

    try {
      const updatedComplaint = await apiJson(
        `/api/local-body/${localBody.id}/complaints/${complaint.id}/priority`,
        { method: "PATCH" }
      );
      setComplaints((current) =>
        current.map((item) => (item.id === updatedComplaint.id ? updatedComplaint : item))
      );
      setAllComplaints((current) =>
        current.map((item) => (item.id === updatedComplaint.id ? updatedComplaint : item))
      );
      setStatusMessage("Complaint priority checked.");
    } catch (err) {
      setStatusMessage(err.message);
    } finally {
      setCheckingPriorityId(null);
    }
  }

  async function sendEmail(event) {
    event.preventDefault();
    setEmailStatus("");
    setEmailError("");
    setSendingEmail(true);

    try {
      const form = new FormData(event.currentTarget);
      const data = await apiJson("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      setEmailStatus(data.message);
      event.currentTarget.reset();
    } catch (err) {
      setEmailError(err.message);
    } finally {
      setSendingEmail(false);
    }
  }

  const totalComplaints = departments.reduce((total, department) => total + department.complaint_count, 0);
  const activeDepartments = departments.filter((department) => department.complaint_count > 0).length;
  const departmentCounts = Object.fromEntries(
    departments.map((department) => [department.name, department.complaint_count])
  );
  const statusCounts = countBy(complaints, "status");

  return (
    <section className="dashboard-page">
      <div className="panel">
        <h1>Local Body Dashboard</h1>
        <p>{localBody.area_name} {localBody.body_type}, {localBody.district}, {localBody.state || "Maharashtra"}</p>
        <div className="actions">
          <button type="button" onClick={() => setAllMapOpen(true)}>View Complaint Map</button>
        </div>
      </div>

      <section className="stat-grid">
        <StatCard label="Total complaints" value={allComplaints.length || totalComplaints} />
        <StatCard label="Active departments" value={activeDepartments} />
        <StatCard label="Selected complaints" value={complaints.length} />
      </section>

      <section className="chart-grid">
        <BarChart title="Complaints by Department" data={departmentCounts} onSelect={openDepartment} />
        <BarChart title="Status in Selected Department" data={statusCounts} />
      </section>

      <section className="department-grid">
        {departments.map((department) => (
          <button
            className="department-card"
            key={department.name}
            onClick={() => openDepartment(department.name)}
          >
            <strong>{department.name}</strong>
            <span>{department.complaint_count} complaints</span>
          </button>
        ))}
      </section>

      <div className="panel">
        <h2>Send Email</h2>
        {emailStatus && <p className="success">{emailStatus}</p>}
        {emailError && <p className="error">{emailError}</p>}
        <form className="nested-form" onSubmit={sendEmail}>
          <label>To Email<input name="to_email" type="email" required /></label>
          <label>Subject<input name="subject" required /></label>
          <label>Body<textarea name="body" rows="6" required /></label>
          <button disabled={sendingEmail}>{sendingEmail ? "Sending..." : "Send Email"}</button>
        </form>
      </div>

      {selectedDepartment && (
        <div className="panel">
          <h2>{selectedDepartment}</h2>
          {statusMessage && <p className="hint">{statusMessage}</p>}
          {complaints.length === 0 && <p>No complaints in this department yet.</p>}
          {complaints.map((complaint) => (
            <article className="complaint" key={complaint.id}>
              <h3>{complaint.title}</h3>
              <p>{complaint.description}</p>
              {complaint.image_filename && <img src={`${API_BASE}/uploads/${complaint.image_filename}`} alt="Complaint" />}
              <p className="muted">Department: {complaint.department}</p>
              <div className="priority-row">
                {complaint.priority ? (
                  <span className={`priority-pill ${getPriorityClass(complaint.priority)}`}>
                    {complaint.priority} Priority
                  </span>
                ) : (
                  <span className="muted">Priority not checked yet.</span>
                )}
                <button
                  className="priority-button"
                  type="button"
                  disabled={checkingPriorityId === complaint.id}
                  onClick={() => checkPriority(complaint)}
                >
                  {checkingPriorityId === complaint.id ? "Checking..." : "Check Priority"}
                </button>
              </div>
              <div className="gps-row">
                <p className="muted">GPS: {complaint.latitude}, {complaint.longitude}</p>
                <button
                  className="map-button"
                  type="button"
                  disabled={!hasGps(complaint)}
                  onClick={() => setMapComplaint(complaint)}
                >
                  View Map
                </button>
              </div>
              {complaint.address && <p className="muted">Address: {complaint.address}</p>}
              <div className="status-control">
                <label>
                  Status
                  <select
                    value={statusDrafts[complaint.id] || complaint.status}
                    onChange={(event) =>
                      setStatusDrafts((current) => ({
                        ...current,
                        [complaint.id]: event.target.value,
                      }))
                    }
                  >
                    {COMPLAINT_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={updatingStatusId === complaint.id}
                  onClick={() => updateStatus(complaint)}
                >
                  {updatingStatusId === complaint.id ? "Updating..." : "Update Status"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {mapComplaint && (
        <ComplaintMapModal
          title="Complaint Location"
          subtitle={mapComplaint.title}
          complaints={[mapComplaint]}
          onClose={() => setMapComplaint(null)}
        />
      )}

      {allMapOpen && (
        <ComplaintMapModal
          title="Local Body Complaint Map"
          subtitle={`${localBody.area_name} complaints only`}
          complaints={allComplaints}
          onClose={() => setAllMapOpen(false)}
        />
      )}
    </section>
  );
}

function ComplaintMapModal({ title, subtitle, complaints, onClose }) {
  const firstComplaint = complaints.find(hasGpsCoordinates);
  const openMapUrl = firstComplaint
    ? `https://www.openstreetmap.org/?mlat=${Number(firstComplaint.latitude)}&mlon=${Number(firstComplaint.longitude)}#map=16/${Number(firstComplaint.latitude)}/${Number(firstComplaint.longitude)}`
    : "https://www.openstreetmap.org";

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="map-title">
      <div className="map-modal">
        <div className="modal-header">
          <div>
            <h2 id="map-title">{title}</h2>
            <p className="muted">{subtitle}</p>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Close map">x</button>
        </div>
        <ComplaintMap complaints={complaints} height={520} />
        <div className="map-footer">
          <span className="muted">{complaints.filter(hasGpsCoordinates).length} mapped complaints</span>
          <a href={openMapUrl} target="_blank" rel="noreferrer">Open full map</a>
        </div>
      </div>
    </div>
  );
}

function SeedLogins() {
  const [logins, setLogins] = useState([]);

  useEffect(() => {
    apiJson("/api/local-body-logins").then(setLogins);
  }, []);

  return (
    <section className="data-page">
      <h1>Seed Logins</h1>
      <table>
        <thead>
          <tr><th>Type</th><th>State</th><th>Area</th><th>District</th><th>Username</th><th>Password</th></tr>
        </thead>
        <tbody>
          {logins.map((login) => (
            <tr key={login.id}>
              <td>{login.body_type}</td>
              <td>{login.state}</td>
              <td>{login.area_name}</td>
              <td>{login.district}</td>
              <td>{login.username}</td>
              <td>{login.password}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
