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

### Étape 2 : Rendre le Script Exécutable

```bash
chmod +x run.sh
```

### Étape 3 : Installer les Dépendances

**Backend (Python) :**
```bash
cd backend
pip install -r requirements.txt
cd ..
```

**Frontend (React) :**
```bash
cd frontend
npm install
cd ..
```

> [!TIP]
> Le script `run.sh` ne réinstalle pas les dépendances à chaque lancement pour gagner du temps. Vous ne devez faire cette étape qu'**une seule fois**.

---

## ▶️ Lancement du Système

Pour démarrer **tous les services** en une seule commande :

```bash
./run.sh
```

**Ce qui démarre :**

| Service | Port | URL |
|---------|------|-----|
| 🐍 Backend (API) | 8000 | http://localhost:8000 |
| 🖥️ Frontend (UI) | 5173 | http://localhost:5173 |
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
   - ➡️ Un QR Code SumUp apparaît
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
- Erreur de connexion à l'API SumUp
- Identifiants SumUp invalides

**Solution :**
1. Vérifiez les logs dans le terminal où vous avez lancé `./run.sh`
2. Vérifiez vos identifiants dans `backend/config.py` ou créez un fichier `.env` :
   ```bash
   SUMUP_CLIENT_ID=votre_client_id
   SUMUP_CLIENT_SECRET=votre_secret
   SUMUP_MERCHANT_CODE=votre_code
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
- Erreur WebSocket

**Solution :**
1. Vérifiez que le Backend tourne bien (regardez les logs)
2. Ouvrez la console du navigateur (**F12**)
3. Cherchez des erreurs WebSocket dans l'onglet "Console"

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
   ./run.sh
   ```

> [!WARNING]
> Assurez-vous que le port série est correctement configuré avant de désactiver le mode simulation !
