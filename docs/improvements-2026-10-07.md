# Améliorations et nettoyage — 7 octobre 2026

Les ajustements suivent les zones signalées dans les captures : actions trop orange, ruptures de fond du tableau des ports et hauteur de l’en-tête d’aperçu.

## Interface et parcours

- Boutons neutres dans le thème pour lancer un serveur arrêté et créer un projet. Les états vides de l’aperçu et des logs partagent le même composant.
- Tableau des ports sur une surface uniforme, avec cadre arrondi et survol cohérent jusque dans la colonne d’actions fixe.
- En-tête d’aperçu ramené à deux rangées sur les grandes fenêtres et adapté aux petites largeurs.
- Commandes serveur partagées entre le tableau de bord et les projets, bouton Redémarrer, état de progression et verrou par serveur. L’aperçu, les logs et la relance automatique utilisent les mêmes opérations.
- Un redémarrage attend la fin de l’arrêt. Un arrêt échoué bloque le lancement du remplaçant et permet de réessayer.
- Une sortie anormale affiche son code ou l’erreur d’attente native, avec accès à la console correspondante. Les arrêts volontaires et sorties normales restent distingués.
- L’aperçu mémorise serveur, adresse, format, dimensions libres et zoom. Une ouverture explicite depuis un projet prend priorité sur la mémoire ; les préférences invalides sont ignorées.
- La copie du chemin de projet indique le succès ou l’erreur du presse-papier.

## Code

- Suppression de `DashboardView` inutilisé, de l’ancien `IframePreviewModal`, de leurs branches mortes et des logos React/Vite de démarrage.
- Suppression des états et timers inutilisés pour la copie des chemins.
- Découpage des paramètres en sections, avec sauvegarde séquentielle conservée dans leur vue principale.
- Découpage de la feuille CSS par surface en conservant l’ordre de cascade.
- Lecture, écriture et synchronisation des anciennes clés Portly et des clés Sprint centralisées. La compatibilité reste utile aux configurations existantes.
- Fixtures IPC partagées entre les deux scripts de vérification.

## Validation

Vérifications réussies : lint sans avertissement, build de production, 138 contrôles UI, 32 contrôles des actions serveur et 11 tests Rust. Les parcours UI utilisent Playwright et les mocks officiels Tauri : aucun serveur personnel n’est lancé ou arrêté.

Les captures et rapports sont générés dans `test-results/`, ignoré par Git. Les détails natifs de sortie nécessitent l’exécutable compilé avec cette version du moteur ; les parcours de l’interface sont validés avec les événements IPC simulés.
