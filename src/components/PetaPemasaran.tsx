"use client";

import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LokasiPemasaran {
  id: string;
  nama: string;
  wilayah: string;
  negara: string;
  lat: number;
  lng: number;
  foto: string;
  tipe: "pusat" | "cabang";
}

interface NavigasiNegara {
  nama: string;
  koordinat: [number, number];
  zoom: number;
}

const FOTO_MARKER_URL = "https://files.catbox.moe/9qm2ex.jpeg";

const semuaLokasi: LokasiPemasaran[] = [
  { id: "pusat", nama: "Headquarters Pusat Marketing", wilayah: "DKI Jakarta", negara: "Indonesia", lat: -6.2088, lng: 106.8456, foto: "https://files.catbox.moe/9qm2ex.jpeg", tipe: "pusat" },
  { id: "id1", nama: "Desa Bojong Kulur", wilayah: "Jawa Barat", negara: "Indonesia", lat: -6.3476, lng: 106.9674, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "id13", nama: "Kota Bekasi", wilayah: "Jawa Barat", negara: "Indonesia", lat: -6.2383, lng: 106.9756, foto: "https://files.catbox.moe/9qm2ex.jpeg", tipe: "cabang" },
  { id: "id14", nama: "Kota Bogor", wilayah: "Jawa Barat", negara: "Indonesia", lat: -6.595, lng: 106.8166, foto: "https://files.catbox.moe/9qm2ex.jpeg", tipe: "cabang" },
  { id: "id2", nama: "Kota Bandung", wilayah: "Jawa Barat", negara: "Indonesia", lat: -6.9175, lng: 107.6191, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "id3", nama: "Kecamatan Windusari", wilayah: "Jawa Tengah", negara: "Indonesia", lat: -7.4222, lng: 110.1415, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "id4", nama: "Kota Semarang", wilayah: "Jawa Tengah", negara: "Indonesia", lat: -6.9667, lng: 110.4167, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "id5", nama: "Desa Ngadas, Bromo", wilayah: "Jawa Timur", negara: "Indonesia", lat: -7.9254, lng: 112.9038, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "id6", nama: "Kota Surabaya", wilayah: "Jawa Timur", negara: "Indonesia", lat: -7.2575, lng: 112.7521, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "id7", nama: "Ubud", wilayah: "Bali", negara: "Indonesia", lat: -8.5069, lng: 115.2625, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "id8", nama: "Kota Medan", wilayah: "Sumatera Utara", negara: "Indonesia", lat: 3.5952, lng: 98.6722, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "id15", nama: "Kota Bandar Lampung", wilayah: "Lampung", negara: "Indonesia", lat: -5.3971, lng: 105.2668, foto: "https://files.catbox.moe/9qm2ex.jpeg", tipe: "cabang" },
  { id: "id9", nama: "Kota Makassar", wilayah: "Sulawesi Selatan", negara: "Indonesia", lat: -5.1477, lng: 119.4327, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "id10", nama: "Kota Balikpapan", wilayah: "Kalimantan Timur", negara: "Indonesia", lat: -1.2654, lng: 116.8312, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "id11", nama: "Kota Ambon", wilayah: "Maluku", negara: "Indonesia", lat: -3.6547, lng: 128.1906, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "id12", nama: "Kota Jayapura", wilayah: "Papua", negara: "Indonesia", lat: -2.5488, lng: 140.6689, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "my1", nama: "Kuala Lumpur City", wilayah: "W. Persekutuan", negara: "Malaysia", lat: 3.139, lng: 101.6869, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "my2", nama: "George Town", wilayah: "Penang", negara: "Malaysia", lat: 5.4141, lng: 100.3288, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "my3", nama: "Johor Bahru", wilayah: "Johor", negara: "Malaysia", lat: 1.4927, lng: 103.7414, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "my4", nama: "Shah Alam", wilayah: "Selangor", negara: "Malaysia", lat: 3.0738, lng: 101.5183, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "my5", nama: "Kota Kinabalu", wilayah: "Sabah", negara: "Malaysia", lat: 5.9804, lng: 116.0735, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "my6", nama: "Kuching", wilayah: "Sarawak", negara: "Malaysia", lat: 1.5533, lng: 110.3592, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "my7", nama: "Malacca City", wilayah: "Malacca", negara: "Malaysia", lat: 2.1896, lng: 102.2501, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "my8", nama: "Ipoh", wilayah: "Perak", negara: "Malaysia", lat: 4.5921, lng: 101.0901, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "us1", nama: "New York City", wilayah: "New York", negara: "Amerika Serikat", lat: 40.7128, lng: -74.006, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "us2", nama: "Los Angeles", wilayah: "California", negara: "Amerika Serikat", lat: 34.0522, lng: -118.2437, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "us3", nama: "Chicago", wilayah: "Illinois", negara: "Amerika Serikat", lat: 41.8781, lng: -87.6298, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "us4", nama: "Houston", wilayah: "Texas", negara: "Amerika Serikat", lat: 29.7604, lng: -95.3698, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "ph1", nama: "Manila City", wilayah: "Metro Manila", negara: "Filipina", lat: 14.5995, lng: 120.9842, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
  { id: "ph2", nama: "Cebu City", wilayah: "Central Visayas", negara: "Filipina", lat: 10.3157, lng: 123.8854, foto: "/maintenancelogo.jpeg", tipe: "cabang" },
];

function zonaWaktuLokasi(lokasi: LokasiPemasaran) {
  if (lokasi.negara === "Malaysia") return "Asia/Kuala_Lumpur";
  if (lokasi.negara === "Filipina") return "Asia/Manila";
  if (lokasi.negara === "Amerika Serikat") {
    if (lokasi.nama === "New York City") return "America/New_York";
    if (lokasi.nama === "Los Angeles") return "America/Los_Angeles";
    if (lokasi.nama === "Chicago") return "America/Chicago";
    return "America/Chicago";
  }
  if (lokasi.wilayah === "Papua") return "Asia/Jayapura";
  if (["Bali", "Sulawesi Selatan", "Kalimantan Timur", "Maluku"].includes(lokasi.wilayah)) return "Asia/Makassar";
  return "Asia/Jakarta";
}

function jamLokal(lokasi: LokasiPemasaran, waktu: Date) {
  const jam = Number(new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: zonaWaktuLokasi(lokasi),
  }).format(waktu));
  return jam === 24 ? 0 : jam;
}

const dataNegaraNavigasi: NavigasiNegara[] = [
  { nama: "Indonesia", koordinat: [-2.5489, 118.0149], zoom: 5 },
  { nama: "Malaysia", koordinat: [4.2105, 101.9758], zoom: 6 },
  { nama: "Filipina", koordinat: [12.8797, 121.774], zoom: 6 },
  { nama: "Amerika", koordinat: [37.0902, -95.7129], zoom: 4 },
];

const singkatanNegara: Record<string, string> = {
  Indonesia: "IDN",
  Malaysia: "MYS",
  Filipina: "PHL",
  Amerika: "USA",
};

function buatIkonFoto(tipe: LokasiPemasaran["tipe"], malam: boolean) {
  const isPusat = tipe === "pusat";
  const ukuran = isPusat ? 56 : 46;

  return L.divIcon({
    html: `<div class="marketing-pin marketing-pin-${isPusat ? "pusat" : "cabang"} ${malam ? "marketing-pin-night" : ""}"><img src="${FOTO_MARKER_URL}" alt="" /></div>`,
    className: "marketing-pin-wrapper",
    iconSize: [ukuran, ukuran],
    iconAnchor: [ukuran / 2, ukuran / 2],
    popupAnchor: [0, -ukuran / 2],
  });
}

function MapController({ targetCenter, targetZoom }: { targetCenter: [number, number]; targetZoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(targetCenter, targetZoom, { duration: 1.2 });
  }, [map, targetCenter, targetZoom]);

  return null;
}

function MapSizeSync() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const refreshSize = () => map.invalidateSize({ animate: false });
    const frameId = window.requestAnimationFrame(refreshSize);
    const resizeObserver = new ResizeObserver(refreshSize);
    resizeObserver.observe(container);
    window.addEventListener("resize", refreshSize);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", refreshSize);
    };
  }, [map]);

  return null;
}

export default function PetaPemasaran() {
  const [petaCenter, setPetaCenter] = useState<[number, number]>([15, 40]);
  const [petaZoom, setPetaZoom] = useState(3);
  const [waktuSekarang, setWaktuSekarang] = useState(() => new Date());
  const [menuTerbuka, setMenuTerbuka] = useState(false);
  const [negaraTerpilih, setNegaraTerpilih] = useState("Indonesia");

  useEffect(() => {
    if (!menuTerbuka) {
      return;
    }

    const timeoutId = window.setTimeout(() => setMenuTerbuka(false), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [menuTerbuka]);

  const bukaMenuNegara = () => {
    setMenuTerbuka(true);
  };

  useEffect(() => {
    const clockTimer = window.setInterval(() => setWaktuSekarang(new Date()), 60 * 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  return (
    <section className="marketing-map" aria-labelledby="marketing-map-title">
      <div className="marketing-map-stage">
        <img className="marketing-map-logo" src="https://files.catbox.moe/9qm2ex.jpeg" alt="Tokko Marketplace" />
        <div className="marketing-map-canvas">
        <MapContainer center={petaCenter} zoom={petaZoom} minZoom={2} maxZoom={15} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          <MapSizeSync />
          <MapController targetCenter={petaCenter} targetZoom={petaZoom} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {semuaLokasi.map((lokasi) => {
            const jam = jamLokal(lokasi, waktuSekarang);
            const malam = jam >= 23 || jam < 8;
            return (
            <Marker key={lokasi.id} position={[lokasi.lat, lokasi.lng]} icon={buatIkonFoto(lokasi.tipe, malam)}>
              <Popup>
                <strong>{lokasi.nama}</strong>
                <br />
                {lokasi.wilayah}, {lokasi.negara}
              </Popup>
            </Marker>
            );
          })}
        </MapContainer>
        <div className="marketing-map-live" aria-label="Peta aktif">
          <span className="marketing-map-live-dot" />
          Live
        </div>
        </div>
        <div className={`marketing-map-picker ${menuTerbuka ? "marketing-map-picker-open" : ""}`}>
        <div className="marketing-map-controls" aria-label="Pilih wilayah peta">
          {dataNegaraNavigasi.map((negara) => (
            <button
              key={negara.nama}
              type="button"
              className={negaraTerpilih === negara.nama ? "marketing-map-selected" : undefined}
              onClick={() => {
                setPetaCenter(negara.koordinat);
                setPetaZoom(negara.zoom);
                setNegaraTerpilih(negara.nama);
                setMenuTerbuka(false);
              }}
            >
              <span className="marketing-map-full-label">{negara.nama}</span>
              <span className="marketing-map-short-label">{singkatanNegara[negara.nama]}</span>
            </button>
          ))}
        </div>
        <button
          className="marketing-map-open"
          type="button"
          onClick={menuTerbuka ? () => setMenuTerbuka(false) : bukaMenuNegara}
        >
          {menuTerbuka ? "Tutup pilihan" : "Pilih negara"}
        </button>
        </div>
      </div>
    </section>
  );
}
