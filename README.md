# 🍼 Liam · Registro del bebé

App sencilla para registrar durante el día:

- **Tomas de biberón** (ml y hora)
- **Pañales** mojados 💧 y/o manchados 💩

Hecha con **Nuxt 4** (frontend + API en Node.js/Nitro) y **Tailwind CSS 4**.
Los datos se guardan en `data/events.json` (volumen de Docker).

## Desarrollo local

```bash
npm install
npm run dev        # http://localhost:3000
```

## Despliegue en VPS con Docker

Arquitectura: un **proxy común** (`proxy/`, Caddy) recibe el tráfico en 80/443 y lo reparte por
subdominio a cada app. Cada app declara su subdominio con etiquetas en su `docker-compose.yml`
y el proxy obtiene el certificado HTTPS automáticamente.

La imagen se construye en **GitHub Actions** y se publica en `ghcr.io/kumoq-code/liam:latest`;
el VPS solo la descarga (compilar Nuxt en un VPS de 1 GB agota la RAM).

### 0. Requisitos
- DNS: registro **A** `liam.tudominio.com` → IP del VPS (o un comodín `*.tudominio.com`).
- Puertos **80 y 443** abiertos (ufw y firewall del proveedor).
- Login en GHCR si el repo es privado (token con `read:packages`):
  `echo TOKEN | docker login ghcr.io -u USUARIO --password-stdin`

### 1. Proxy (una sola vez para todas las apps)

```bash
git clone https://github.com/kumoq-code/liam.git /srv/liam
cp -r /srv/liam/proxy /srv/proxy
cd /srv/proxy && docker compose up -d
```

### 2. App

```bash
cd /srv/liam
cp .env.example .env
nano .env          # DOMAIN, AUTH_PASSWORD...
docker compose pull && docker compose up -d
```

Abre `https://liam.tudominio.com`.

### Añadir otra app

En su `docker-compose.yml`, únela a la red `proxy` y añade las etiquetas:

```yaml
services:
  otra:
    image: ...
    networks: [proxy]
    labels:
      caddy: otra.tudominio.com
      caddy.reverse_proxy: "{{upstreams 8080}}"   # puerto interno de la app
networks:
  proxy:
    external: true
```

### Actualizar

```bash
cd /srv/liam && git pull && docker compose pull && docker compose up -d
```

### Compilar en el propio VPS (alternativa)

Necesita ~1,5 GB de RAM libre; con 1 GB añade swap antes:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
docker compose build && docker compose up -d
```

### Copia de seguridad

Todos los datos están en `./data/events.json`:

```bash
cp data/events.json ~/backup-liam-$(date +%F).json
```

### Variables de entorno (`.env`)

| Variable        | Por defecto     | Descripción                                    |
| --------------- | --------------- | ---------------------------------------------- |
| `DOMAIN`        | _(obligatorio)_ | Subdominio de la app                           |
| `TZ`            | `Europe/Madrid` | Zona horaria del contenedor                    |
| `AUTH_USER`     | _(vacío)_       | Usuario de acceso (vacío = cualquier usuario)  |
| `AUTH_PASSWORD` | _(vacío)_       | Contraseña. Vacío = sin protección             |
