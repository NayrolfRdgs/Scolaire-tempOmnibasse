#!/usr/bin/env bash
# =============================================================================
# install_pi.sh — Installation de l'Omnibasse sur Raspberry Pi
# Usage : sudo ./install_pi.sh
# =============================================================================
set -euo pipefail

# --- Variables ----------------------------------------------------------------
INSTALL_DIR="/home/pi/omnibasse"
BACKEND_DIR="${INSTALL_DIR}/backend"
VENV_DIR="${BACKEND_DIR}/.venv"
SERVICE_NAME="omnibasse"
SERVICE_SRC="${BACKEND_DIR}/omnibasse.service"
SERVICE_DEST="/etc/systemd/system/${SERVICE_NAME}.service"
PI_USER="pi"

# --- Couleurs -----------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# --- Vérifications préalables -------------------------------------------------
info "=== Installation Omnibasse sur Raspberry Pi ==="
echo

[[ $EUID -ne 0 ]] && error "Ce script doit être lancé avec sudo."
[[ ! -d "$BACKEND_DIR" ]] && error "Dossier backend non trouvé : $BACKEND_DIR"

# --- 1. Dépendances système ---------------------------------------------------
info "Mise à jour des paquets système..."
apt-get update -qq

info "Installation des dépendances système..."
apt-get install -y \
    python3-pip \
    python3-venv \
    i2c-tools \
    libasound2-dev \
    portaudio19-dev \
    libatlas-base-dev \
    git \
    > /dev/null

info "Dépendances système installées."

# --- 2. Activation de l'I2C --------------------------------------------------
info "Activation du bus I2C..."

# Méthode 1 : via /boot/config.txt (compatible toutes versions)
BOOT_CONFIG="/boot/config.txt"
if [[ -f "$BOOT_CONFIG" ]]; then
    if ! grep -q "^dtparam=i2c_arm=on" "$BOOT_CONFIG"; then
        echo "dtparam=i2c_arm=on" >> "$BOOT_CONFIG"
        info "I2C activé dans $BOOT_CONFIG (redémarrage nécessaire)"
    else
        info "I2C déjà activé dans $BOOT_CONFIG"
    fi
fi

# Méthode 2 : via /boot/firmware/config.txt (Raspberry Pi OS Bookworm)
BOOT_FW_CONFIG="/boot/firmware/config.txt"
if [[ -f "$BOOT_FW_CONFIG" ]]; then
    if ! grep -q "^dtparam=i2c_arm=on" "$BOOT_FW_CONFIG"; then
        echo "dtparam=i2c_arm=on" >> "$BOOT_FW_CONFIG"
        info "I2C activé dans $BOOT_FW_CONFIG"
    fi
fi

# Charger le module i2c-dev immédiatement (sans redémarrage)
if ! lsmod | grep -q "i2c_dev"; then
    modprobe i2c-dev 2>/dev/null && info "Module i2c-dev chargé." || warn "Impossible de charger i2c-dev (peut nécessiter un redémarrage)"
fi

# S'assurer que le module est chargé au boot
if ! grep -q "i2c-dev" /etc/modules 2>/dev/null; then
    echo "i2c-dev" >> /etc/modules
fi

# --- 3. Virtualenv Python ----------------------------------------------------
info "Création du virtualenv Python dans $VENV_DIR..."
sudo -u "$PI_USER" python3 -m venv "$VENV_DIR"

info "Installation des dépendances Python..."
sudo -u "$PI_USER" "${VENV_DIR}/bin/pip" install --upgrade pip --quiet
sudo -u "$PI_USER" "${VENV_DIR}/bin/pip" install -r "${BACKEND_DIR}/requirements.txt" --quiet

info "Dépendances Python installées."

# --- 4. Fichier .env ---------------------------------------------------------
ENV_FILE="${BACKEND_DIR}/.env"
ENV_EXAMPLE="${BACKEND_DIR}/.env.example"

if [[ ! -f "$ENV_FILE" && -f "$ENV_EXAMPLE" ]]; then
    sudo -u "$PI_USER" cp "$ENV_EXAMPLE" "$ENV_FILE"
    info "Fichier .env créé depuis .env.example (personnalisez-le si nécessaire)"
elif [[ -f "$ENV_FILE" ]]; then
    info "Fichier .env existant conservé."
else
    warn "Pas de .env.example trouvé, .env non créé."
fi

# --- 5. Service systemd -------------------------------------------------------
info "Installation du service systemd ${SERVICE_NAME}..."

[[ ! -f "$SERVICE_SRC" ]] && error "Fichier service introuvable : $SERVICE_SRC"

cp "$SERVICE_SRC" "$SERVICE_DEST"
chmod 644 "$SERVICE_DEST"

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.service"
systemctl start  "${SERVICE_NAME}.service"

# Vérification
sleep 2
if systemctl is-active --quiet "${SERVICE_NAME}"; then
    info "Service ${SERVICE_NAME} démarré avec succès !"
else
    warn "Service ${SERVICE_NAME} non démarré. Vérifiez avec : sudo journalctl -u ${SERVICE_NAME} -n 30"
fi

# --- 6. Vérification I2C (si hardware connecté) ------------------------------
echo
info "=== Vérification du bus I2C ==="
if command -v i2cdetect &>/dev/null; then
    i2cdetect -y 1 2>/dev/null || warn "Bus I2C non accessible (redémarrage peut être nécessaire)"
else
    warn "i2cdetect non disponible"
fi

# --- Résumé ------------------------------------------------------------------
echo
info "=== Installation terminée ==="
echo
echo "  Backend URL : http://$(hostname -I | awk '{print $1}'):8000"
echo "  API Docs    : http://$(hostname -I | awk '{print $1}'):8000/docs"
echo
echo "  Commandes utiles :"
echo "    sudo systemctl status ${SERVICE_NAME}"
echo "    sudo journalctl -u ${SERVICE_NAME} -f"
echo "    i2cdetect -y 1"
echo
warn "Un redémarrage peut être nécessaire pour activer l'I2C si c'était désactivé."
