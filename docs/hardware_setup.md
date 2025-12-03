# Guide Configuration Hardware

## 📦 Matériel Requis

| Composant | Spécification | Notes |
|-----------|---------------|-------|
| **💻 Raspberry Pi** | 3B+ ou 4 | Le modèle 4 est recommandé pour de meilleures performances |
| **🔌 Qibixx MDB Pi Hat Plus** | Version complète | Permet la communication MDB |
| **🔗 Câble MDB** | Standard | Généralement fourni avec le Hat |
| **📺 Écran DSI** | 7" tactile officiel | Ou compatible Raspberry Pi |
| **⚡ Alimentation** | 5V 3A USB-C | OU alimentation via bus MDB |

---

## 🔧 Configuration du Qibixx Pi Hat

> [!WARNING]
> **Attention aux Cavaliers !**
> Une mauvaise configuration des jumpers peut endommager le matériel. Consultez toujours la [documentation officielle Qibixx](https://qibixx.com).

### Étape 1 : Mode de Fonctionnement

Pour ce projet, le Pi agit comme un **Périphérique de paiement (Cashless Device)** :

- ✅ Le Pi **REÇOIT** les ordres du distributeur
- ✅ Le Pi **RÉPOND** avec APPROVE/DENY
- ❌ Le Pi ne contrôle PAS le distributeur (ce n'est pas un VMC)

### Étape 2 : Configuration des Jumpers

**Interface de Communication :**
- Configurez le Hat pour utiliser l'**UART** du Raspberry Pi
- Port série : `/dev/ttyAMA0` ou `/dev/serial0`

**Alimentation 5V :**

| Scénario | Position du Cavalier | Avantage |
|----------|---------------------|----------|
| Alimenté par MDB | Sur **MDB** | Un seul câble, installation simple |
| Alimenté par USB | Sur **Ext** ou retiré | Plus stable, recommandé pour le développement |

### Étape 3 : Connexion Physique

1. ⚠️ **Éteignez le distributeur** (VMC)
2. 🔌 Branchez le connecteur Molex MDB du Hat au bus MDB
3. 🔩 Fixez le Hat sur les GPIO du Raspberry Pi
4. 📺 Connectez l'écran DSI
5. ✅ Allumez le distributeur (il alimentera le Pi si configuré ainsi)

---

## 🐧 Configuration Raspberry Pi OS

### Activer le Port Série (UART)

Le Qibixx Hat communique via le port série matériel. Il faut l'activer :

**Via raspi-config :**

```bash
sudo raspi-config
```

Naviguez dans :
```
Interface Options → Serial Port
```

Répondez :
- **"Login shell over serial?"** → ❌ **NO**
- **"Serial port hardware enabled?"** → ✅ **YES**

Redémarrez :
```bash
sudo reboot
```

### Vérification

Après redémarrage, vérifiez que le port existe :

```bash
ls -l /dev/serial0
```

**Résultat attendu :**
```
lrwxrwxrwx 1 root root 7 Dec  3 20:00 /dev/serial0 -> ttyAMA0
```

> [!TIP]
> Si le port pointe vers `ttyS0` au lieu de `ttyAMA0`, mettez à jour `backend/config.py` avec le bon chemin.

---

## ✅ Checklist Finale

Avant de lancer le logiciel, vérifiez :

- [ ] Le Hat est bien fixé sur les GPIO
- [ ] Le câble MDB est branché au distributeur
- [ ] L'écran DSI est connecté et allumé
- [ ] Le port série `/dev/serial0` existe
- [ ] La console série est désactivée (pas de login shell)
- [ ] Le Pi démarre correctement
