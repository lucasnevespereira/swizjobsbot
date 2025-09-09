export const MESSAGES = {
  fr: {
    welcome: `👋 Bienvenue dans SwizJobs Bot!

Ce bot vous aide à rester informé des nouvelles offres d'emploi en Suisse.

Commandes disponibles:
/register - Créer votre compte
/config - Configurer vos critères de recherche
/status - Voir le statut de vos alertes
/pause - Suspendre temporairement les alertes
/help - Aide et commandes

Pour commencer, utilisez /register`,

    registration: {
      start: '📝 Créons votre profil d\'alertes emploi!\n\nDans quel canton recherchez-vous du travail?',
      selectCanton: 'Veuillez sélectionner un canton valide:',
      success: '✅ Inscription réussie! Utilisez /config pour définir vos critères de recherche d\'emploi.',
      alreadyRegistered: '✅ Vous êtes déjà inscrit! Utilisez /config pour modifier vos préférences.'
    },

    config: {
      start: '⚙️ Configuration de vos alertes emploi\n\nQue souhaitez-vous configurer?',
      keywords: 'Entrez vos mots-clés de recherche (séparés par des virgules):\nExemple: secrétaire, administration, rh',
      locations: 'Dans quels cantons cherchez-vous? (séparés par des virgules):\nExemple: Vaud, Valais, Geneva',
      frequency: 'À quelle fréquence voulez-vous être notifié?\n1 = Toutes les heures\n2 = Toutes les 2 heures\n6 = Toutes les 6 heures\n24 = Une fois par jour',
      maxAge: 'Quel âge maximum pour les offres? (en jours, par défaut: 7)',
      success: '✅ Configuration sauvegardée! Vos alertes sont maintenant actives.',
      updated: '✅ Configuration mise à jour!'
    },

    status: {
      active: '✅ Vos alertes emploi sont ACTIVES',
      paused: '⏸️ Vos alertes emploi sont EN PAUSE',
      notRegistered: '❌ Vous n\'êtes pas encore inscrit. Utilisez /register'
    },

    job: {
      newJobTitle: '🔔 Nouvelle offre d\'emploi!',
      company: '🏢 Entreprise',
      location: '📍 Lieu',
      posted: '📅 Publié',
      apply: '🔗 Postuler',
      footer: 'Tapez /pause pour arrêter les alertes'
    },

    commands: {
      pause: '⏸️ Alertes suspendues. Utilisez /start pour les réactiver.',
      resume: '▶️ Alertes réactivées!',
      help: `🤖 SwizJobs Bot - Aide

📋 Commandes disponibles:
/start - Menu principal et réactivation
/register - Créer votre compte
/config - Configurer vos critères de recherche
/status - Voir le statut de vos alertes
/pause - Suspendre les alertes
/help - Cette aide

🎯 Comment ça marche:
1. Inscrivez-vous avec /register
2. Configurez vos critères avec /config
3. Recevez des alertes automatiques pour les nouveaux emplois

📧 Support: Contactez @votre_username pour l'aide`
    },

    errors: {
      notRegistered: '❌ Veuillez d\'abord vous inscrire avec /register',
      invalidInput: '❌ Format invalide. Veuillez réessayer.',
      databaseError: '❌ Erreur technique. Veuillez réessayer plus tard.',
      noKeywords: '❌ Veuillez d\'abord configurer vos mots-clés avec /config'
    }
  }
};
