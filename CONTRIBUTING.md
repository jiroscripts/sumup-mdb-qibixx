# Commitlint

Ce projet utilise [commitlint](https://commitlint.js.org/) pour valider les messages de commit selon la convention [Conventional Commits](https://www.conventionalcommits.org/).

## Format des Commits

Les messages de commit doivent suivre ce format :

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types Autorisés

| Type | Description | Exemple |
|------|-------------|---------|
| `feat` | Nouvelle fonctionnalité | `feat(backend): add MDB simulation mode` |
| `fix` | Correction de bug | `fix(frontend): resolve QR code display issue` |
| `docs` | Documentation | `docs: update hardware setup guide` |
| `style` | Formatage, style | `style: format Python files with black` |
| `refactor` | Refactoring | `refactor(mdb): simplify serial communication` |
| `perf` | Performance | `perf(api): optimize WebSocket polling` |
| `test` | Tests | `test(payment): add unit tests for SumUp service` |
| `build` | Build system | `build: update dependencies` |
| `ci` | CI/CD | `ci: add GitHub Actions workflow` |
| `chore` | Tâches diverses | `chore: update .gitignore` |
| `revert` | Revert | `revert: revert commit abc123` |

### Exemples de Commits Valides

```bash
feat(backend): add WebSocket support for real-time updates
fix(frontend): correct QR code rendering on mobile
docs(readme): add installation instructions
refactor(mdb): extract serial port logic to separate class
```

### Exemples de Commits Invalides

```bash
❌ Added new feature
❌ fix bug
❌ WIP
❌ update code
```

## Validation Automatique

Les commits sont automatiquement validés via un hook Git (husky). Si votre message ne respecte pas la convention, le commit sera rejeté.

Pour tester votre message avant de commiter :

```bash
echo "feat: add new feature" | npx commitlint
```

Ou utilisez la commande make :
```bash
make lint
```
