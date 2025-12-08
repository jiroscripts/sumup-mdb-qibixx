# Guide Utilisateur

## 🚀 Installation

### Prérequis

Avant de commencer, assurez-vous d'avoir :

- ✅ **Raspberry Pi** avec Raspberry Pi OS installé
- ✅ **Connexion Internet** active
- ✅ **Accès terminal** (SSH ou direct)

### Étape 1 : Récupérer le Projet

```bash
git clone <votre-repo>
cd sumup-mdb-qibixx
```

### Étape 2 : Installer les Dépendances

```bash
make install
```

---

## ▶️ Lancement du Système

Pour démarrer **tous les services** en une seule commande :

```bash
make dev
```

**Ce qui démarre :**

| Service | Port | URL |
|---------|------|-----|
| 🐍 Backend (Listener) | - | (Background Process) |
| 🖥️ Frontend (UI) | 5173 | http://localhost:5173 |
| 📱 Web App (Mobile) | 5174 | http://localhost:5174 |
| 📚 Documentation | 3000 | http://localhost:3000 |

### Mode Kiosque (Écran DSI)

Si vous avez un écran connecté au Pi :

1. Ouvrez **Chromium**
2. Allez sur `http://localhost:5173`
3. Appuyez sur **F11** pour le plein écran

---

## 🧪 Mode Simulation (Sans Hardware)

Par défaut, le système fonctionne en **mode simulation**. Vous pouvez tout tester sans distributeur physique !

### Comment Simuler une Transaction

1. **Ouvrez l'interface** : [http://localhost:5173](http://localhost:5173)
2. **Trouvez le panneau Debug** (en bas à droite)
3. **Cliquez sur "Simulate VMC Request (€2.50)"**
   - ➡️ L'écran passe en mode "Chargement..."
   - ➡️ Un QR Code de paiement apparaît
4. **Deux options pour payer :**
   - 📱 **Vrai paiement** : Scannez le QR avec votre téléphone
   - 🎭 **Faux paiement** : Cliquez sur "Simulate Successful Payment"
5. **Résultat** : L'écran affiche "Payment Approved!" puis revient à l'accueil

> [!NOTE]
> En mode simulation, aucune communication série n'est effectuée. C'est parfait pour développer et tester sans matériel.

---

## 🔧 Dépannage

### ❌ Le QR Code ne s'affiche pas

**Causes possibles :**
- Erreur de connexion à Supabase
- Identifiants Stripe invalides (dans Supabase Edge Functions)

**Solution :**
1. Vérifiez les logs dans le terminal où vous avez lancé `make dev`
2. Vérifiez vos variables d'environnement dans `.env`
   ```bash
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### ❌ Erreur "Serial Port not found"

**Causes possibles :**
- Port série non activé
- Mauvais chemin de port
- Mode simulation désactivé par erreur

**Solution :**
1. Activez le port série via `sudo raspi-config` (voir [Hardware Setup](hardware_setup.md))
2. Vérifiez `backend/config.py` :
   ```python
   MDB_SIMULATION_MODE = True  # Pour tester sans hardware
   SERIAL_PORT = "/dev/ttyAMA0"  # Ou /dev/serial0
   ```

### ❌ L'écran reste bloqué sur "Loading..."

**Causes possibles :**
- Backend non démarré
- Erreur Supabase Realtime

**Solution :**
1. Vérifiez que le Backend tourne bien (regardez les logs)
2. Ouvrez la console du navigateur (**F12**)
3. Cherchez des erreurs de connexion Supabase dans l'onglet "Console"

---

## 🔄 Passer en Mode Production

Pour utiliser le **vrai matériel** (Qibixx Hat + Distributeur) :

1. **Configurez le hardware** (voir [Hardware Setup](hardware_setup.md))
2. **Modifiez `backend/config.py`** :
   ```python
   MDB_SIMULATION_MODE = False
   SERIAL_PORT = "/dev/serial0"
   ```
3. **Redémarrez** le système :
   ```bash
   make dev
   ```

> [!WARNING]
> Assurez-vous que le port série est correctement configuré avant de désactiver le mode simulation !

## 🛡️ Sécurité & Production

Ce projet est configuré pour être **Production Ready**.

### 1. Mode Simulation
Dans `backend/config.py` (ou `.env`), la variable `MDB_SIMULATION_MODE` contrôle le comportement :
*   **True** : Le système génère automatiquement des demandes de vente toutes les 10s pour tester.
*   **False** : Le système attend un vrai signal du distributeur (VMC) via le port série.

### 2. Règles de Sécurité (RLS)
La base de données Supabase est verrouillée :
*   **Le Public (Kiosk/App)** ne peut que **LIRE** les sessions. Impossible de créer de fausses ventes ou de valider un paiement manuellement.
*   **Le Système (Bridge/Edge Functions)** a les droits d'écriture via la `SERVICE_ROLE_KEY`.
