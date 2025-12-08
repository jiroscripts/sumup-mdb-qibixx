# Modèle de Données & Événements Realtime
 
Ce document décrit le schéma de base de données Supabase et les événements Realtime utilisés pour la communication entre les composants.

## Base de Données (Supabase)

### Table `vend_sessions`

Cette table est le cœur du système. Elle stocke l'état de chaque transaction.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | `uuid` | Identifiant unique de la session (Primary Key). |
| `created_at` | `timestamptz` | Date de création. |
| `amount` | `numeric` | Montant de la transaction (ex: 2.50). |
| `status` | `text` | État actuel : `PENDING`, `PAID`, `COMPLETED`, `FAILED`. |
| `checkout_id` | `text` | ID du checkout Stripe (optionnel). |
| `metadata` | `jsonb` | Données additionnelles (ex: `machine_id`). |

### Sécurité (RLS)

*   **Lecture (SELECT)** : Publique (Tout le monde peut voir les sessions).
*   **Écriture (INSERT/UPDATE)** : **Restreinte au Service Role**. Seul le MDB Bridge et les Edge Functions peuvent créer ou modifier des sessions. Le Kiosk et l'App Mobile n'ont pas le droit d'écriture.

## Protocole Realtime

Le Bridge et le Kiosk s'abonnent aux changements sur la table `vend_sessions`.

### 1. Nouvelle Demande (Bridge -> Kiosk)

**Déclencheur** : Le Bridge insère une nouvelle ligne dans `vend_sessions`.
**Événement** : `INSERT` sur `vend_sessions`.

**Payload (reçu par le Kiosk)** :
```json
{
  "new": {
    "id": "a1b2c3d4-...",
    "amount": 2.50,
    "status": "PENDING",
    "metadata": { "machine_id": "pi_kiosk_1" }
  }
}
```
**Action Kiosk** : Affiche le QR Code généré à partir de l'ID de session.

### 2. Paiement Validé (Supabase -> Bridge & Kiosk)

**Déclencheur** : Le Webhook Stripe (via Edge Function) met à jour le statut à `PAID`.
**Événement** : `UPDATE` sur `vend_sessions` où `status=PAID`.

**Payload** :
```json
{
  "new": {
    "id": "a1b2c3d4-...",
    "status": "PAID",
    ...
  },
  "old": { "status": "PENDING" }
}
```

**Action Bridge** : Envoie la commande `APPROVE` au distributeur pour libérer le produit.
**Action Kiosk** : Affiche "Paiement Validé".

### 3. Fin de Transaction (Bridge -> Supabase)

**Déclencheur** : Le Bridge a confirmé la distribution.
**Action** : Le Bridge met à jour le statut à `COMPLETED`.

## Edge Functions

### `initiate-wallet-recharge`
*   **Rôle** : Crée un checkout Stripe pour recharger le wallet (ou payer directement).
*   **Input** : `{ "amount": 2.50, "session_id": "..." }`
*   **Output** : `{ "checkout_id": "...", "next_step": "..." }`

### `checkout-session-completed`
*   **Rôle** : Reçoit les notifications de Stripe (Webhook).
*   **Action** : Met à jour la table `transactions` et `vend_sessions` si le paiement est réussi.
