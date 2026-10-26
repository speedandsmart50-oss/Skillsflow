# Closing & Négociation — fondation et étapes

## Périmètre de cette première tranche

La migration `036_closing_academy_foundation.sql` ajoute le modèle de contenu et de progression du parcours pédagogique. Elle ne modifie aucune table existante, ne crée pas encore le salon visible dans l’interface, n’appelle aucun fournisseur IA et n’active aucun abonnement ni paiement.

Le contenu publié est lisible par les comptes authentifiés. La progression, les réponses aux exercices, les évaluations, les révisions et les préférences sont privées au compte. Les contenus brouillons sont réservés au staff déjà défini dans la communauté. Les membres ne peuvent soumettre que leurs réponses ; ils ne peuvent pas s’attribuer une évaluation ou un score via les droits SQL accordés.

## Modèle ajouté

| Table | Rôle |
| --- | --- |
| `learning_tracks` | Parcours et publication |
| `learning_modules` | Niveaux, objectifs et ordre des modules |
| `learning_lessons` | Leçons rattachées aux modules |
| `learning_exercises` | Quiz, pratique, simulation, objection et analyse |
| `learning_content_versions` | Versions de contenu et validation avant publication |
| `learning_competencies` | Compétences et grilles de maîtrise de 0 à 4 |
| `learning_exercise_competencies` | Compétences évaluées par exercice |
| `learning_sources` | Références et dates de vérification renseignées par le staff |
| `learning_module_progress` | Reprise et état d’avancement individuel |
| `learning_attempts` | Réponses privées et feedback évalué |
| `learning_competency_progress` | Niveau de maîtrise et preuve associée |
| `learning_reviews` | Révisions espacées |
| `learning_preferences` | Contexte et préférences fournis par la personne |

## Étapes proposées

1. **Fondation de données (faite localement)** : migration additive, publication contrôlée et RLS.
2. **Navigation et présentation du parcours (faite localement)** : « Closing & Négociation » apparaît dans le menu communautaire et présente les quatre niveaux, leurs thèmes et les espaces interactifs prévus. Cette page est une présentation du programme ; les leçons et la progression enregistrée ne sont pas encore branchées.
3. **Leçons, progression, quiz et exercices** : créer les premières unités pédagogiques réellement accessibles, puis enregistrer et reprendre la progression, avec tests d’isolation entre comptes.
4. **Simulations et coach IA** : seulement après identification d’un fournisseur IA et configuration serveur de ses clés, quotas et coûts. Aucun fournisseur IA n’est présumé configuré.
5. **Analyse de conversations et administration** : opt-in, anonymisation, permissions explicites et validation éditoriale.
6. **Accès gratuit/payant** : à décider ensemble avant d’ajouter un verrou commercial. Cette migration ne facture rien et rend le contenu publié accessible aux membres connectés.
7. **Vérification et déploiement** : tests, revue RLS, migration sur un environnement de préproduction, puis validation avant la production.

## Retour arrière

La migration est additive. Pour annuler cette tranche après vérification des dépendances et uniquement si aucune donnée d’apprentissage n’a été créée, supprimer dans cet ordre : `learning_preferences`, `learning_reviews`, `learning_competency_progress`, `learning_attempts`, `learning_module_progress`, `learning_sources`, `learning_exercise_competencies`, `learning_content_versions`, `learning_exercises`, `learning_lessons`, `learning_modules`, `learning_competencies`, `learning_tracks`. Aucun `DROP` n’est exécuté automatiquement.

