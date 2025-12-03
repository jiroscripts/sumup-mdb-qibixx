# Référence API & WebSocket

## WebSocket Protocol

**URL** : `ws://<IP>:8000/ws`

Le Frontend maintient une connexion permanente avec le Backend via WebSocket pour recevoir les mises à jour d'état en temps réel.

### Messages Serveur -> Client (Frontend)

Tous les messages sont au format JSON avec un champ `type`.

#### 1. Changement d'État
Indique un changement global de l'interface (ex: passage de IDLE à PROCESSING).
```json
{
  "type": "STATE_CHANGE",
  "state": "IDLE | PROCESSING | SHOW_QR | SUCCESS | ERROR"
}
```

#### 2. Afficher QR Code
Envoyé quand une transaction est initiée et que le QR est prêt.
```json
{
  "type": "SHOW_QR",
  "qr_url": "https://...",
  "amount": 2.50,
  "checkout_id": "chk_123456"
}
```

#### 3. Erreur
Envoyé en cas de problème (ex: échec création paiement).
```json
{
  "type": "ERROR",
  "message": "Description de l'erreur"
}
```

---

## API REST (Backend)

Ces endpoints sont principalement utilisés pour le debug ou par le frontend pour des actions ponctuelles.

### Simulation (Debug)

#### Simuler une demande VMC
`POST /api/simulate/vend/{amount}`

Simule la réception d'un signal `VEND_REQUEST` du distributeur.
*   **Paramètres** : `amount` (float) - Montant demandé (ex: 2.50).
*   **Réponse** : `200 OK`

#### Simuler un Paiement Réussi
`POST /api/simulate/payment/{checkout_id}`

Force le backend à considérer un paiement comme validé.
*   **Paramètres** : `checkout_id` (string) - ID du checkout (reçu via WS).
*   **Réponse** : `200 OK`
