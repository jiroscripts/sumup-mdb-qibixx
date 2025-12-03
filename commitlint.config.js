module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            [
                'feat',     // Nouvelle fonctionnalité
                'fix',      // Correction de bug
                'docs',     // Documentation
                'style',    // Formatage, point-virgules manquants, etc.
                'refactor', // Refactoring du code
                'perf',     // Amélioration des performances
                'test',     // Ajout de tests
                'build',    // Changements du système de build
                'ci',       // Changements CI
                'chore',    // Tâches diverses
                'revert'    // Revert d'un commit précédent
            ]
        ],
        'subject-case': [0] // Désactive la vérification de la casse du sujet
    }
};
