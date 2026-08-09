import { COMPANY as C } from './company'
import type { LegalCatalog } from './types'

export const legalFr: LegalCatalog = {
  updatedLabel: 'Dernière mise à jour',
  back: 'Retour à l’accueil',

  imprint: {
    title: 'Mentions légales',
    lead: 'Informations relatives à l’éditeur du site ecobuilder.ai et du service exploité à l’adresse app.ecobuilder.ai, publiées conformément aux obligations européennes et françaises applicables aux services en ligne.',
    sections: [
      {
        heading: 'Éditeur',
        rows: [
          { label: 'Dénomination sociale', value: C.legalName },
          { label: 'Forme juridique', value: C.legalForm },
          { label: 'Capital social', value: C.shareCapital },
          { label: 'Siège social', value: C.address },
          { label: 'Immatriculation', value: C.registration },
          { label: 'Numéro de TVA', value: C.vat },
          { label: 'Contact', value: C.email },
        ],
      },
      {
        heading: 'Directeur de la publication',
        rows: [{ label: 'Responsable de la publication', value: C.publicationDirector }],
      },
      {
        heading: 'Hébergement',
        body: [
          'Le site et le service sont hébergés sur l’infrastructure de l’prestataire ci-dessous. L’ensemble des serveurs applicatifs, bases de données et sauvegardes sont situés dans l’Union européenne.',
        ],
        rows: [
          { label: 'Hébergeur', value: C.hostName },
          { label: 'Adresse de l’hébergeur', value: C.hostAddress },
          { label: 'Localisation des serveurs', value: C.hostRegion },
        ],
      },
      {
        heading: 'Propriété intellectuelle',
        body: [
          'Le logiciel Ecobuilder, la marque, le logo, l’interface et le contenu de ce site sont protégés par le droit de la propriété intellectuelle et demeurent la propriété de l’éditeur. Ecobuilder est un logiciel propriétaire ; l’accès à ce site ne confère aucune licence de copie, de modification ou de redistribution.',
          'Les contenus créés par les clients avec Ecobuilder — leurs pages, textes, images et données — leur appartiennent intégralement. L’éditeur ne revendique aucun droit de propriété sur ceux-ci.',
        ],
      },
      {
        heading: 'Responsabilité',
        body: [
          'L’éditeur veille à l’exactitude et à l’actualité des informations publiées sur ce site, sans garantir qu’elles soient exhaustives ou exemptes d’erreurs, et peut les modifier à tout moment. Les liens vers des sites tiers sont fournis à titre de commodité ; l’éditeur n’en contrôle pas le contenu et n’en est pas responsable.',
          'Les engagements de service, notamment de disponibilité et d’assistance, relèvent des conditions d’abonnement convenues avec chaque client et non des présentes mentions.',
        ],
      },
      {
        heading: 'Signalement de contenus illicites',
        body: [
          `Pour signaler un contenu publié via le service que vous estimez illicite, écrivez à ${C.email} en indiquant l’URL, la description du problème et vos coordonnées. Les signalements sont examinés dans les meilleurs délais.`,
        ],
      },
      {
        heading: 'Règlement des litiges de consommation',
        body: [
          'Les consommateurs résidant dans l’Union européenne peuvent soumettre un litige à la plateforme de règlement en ligne des litiges de la Commission européenne : https://ec.europa.eu/consumers/odr. Nous préférons résoudre tout désaccord directement — contactez-nous avant d’engager une procédure formelle.',
        ],
      },
      {
        heading: 'Données personnelles',
        body: ['Le traitement des données personnelles est décrit dans notre politique de confidentialité.'],
      },
    ],
  },

  privacy: {
    title: 'Politique de confidentialité',
    lead: 'Cette politique explique quelles données personnelles Ecobuilder collecte, pourquoi, sur quelle base légale, pendant combien de temps elles sont conservées et quels droits vous pouvez exercer. Elle couvre le site (ecobuilder.ai) et le service (app.ecobuilder.ai).',
    sections: [
      {
        heading: 'Responsable du traitement',
        body: [
          'Le responsable du traitement est la société identifiée ci-dessous. Pour toute question relative à vos données personnelles, y compris les demandes décrites à la section « Vos droits », écrivez-nous à l’adresse indiquée.',
        ],
        rows: [
          { label: 'Responsable', value: C.legalName },
          { label: 'Adresse', value: C.address },
          { label: 'Contact', value: C.email },
          { label: 'Délégué à la protection des données', value: C.dpo || 'Aucun DPO désigné — écrivez à l’adresse de contact ci-dessus' },
        ],
      },
      {
        heading: 'Ce que nous collectons et pourquoi',
        body: [
          'Nous ne collectons que ce qu’exige chaque finalité. Le tableau précise, pour chacune, les données concernées et la base légale au sens de l’article 6 du RGPD.',
        ],
        table: {
          head: ['Finalité', 'Données', 'Base légale'],
          rows: [
            [
              'Fonctionnement du site',
              'Préférence de langue et choix en matière de cookies, stockés sur votre appareil',
              'Intérêt légitime à fournir un site fonctionnel (art. 6.1.f)',
            ],
            [
              'Réponse à vos messages',
              'Votre adresse e-mail et le contenu de votre message',
              'Intérêt légitime à répondre aux demandes (art. 6.1.f)',
            ],
            [
              'Création et gestion de votre compte',
              'Nom, adresse e-mail, mot de passe (conservé uniquement sous forme d’empreinte cryptographique), paramètres du compte',
              'Exécution du contrat (art. 6.1.b)',
            ],
            [
              'Hébergement des sites que vous créez',
              'Les pages, textes, médias et données que vous choisissez d’enregistrer dans le service',
              'Exécution du contrat (art. 6.1.b)',
            ],
            [
              'Sécurité du service',
              'Tentatives de connexion, informations de session et d’appareil, adresse IP, journal d’audit des actions sensibles',
              'Obligation légale et intérêt légitime à la sécurité (art. 6.1.c, 6.1.f)',
            ],
            [
              'Facturation et comptabilité',
              'Données de facturation et factures traitées par notre prestataire de paiement ; nous ne conservons aucun numéro de carte',
              'Contrat et obligation légale (art. 6.1.b, 6.1.c)',
            ],
            [
              'Mesure d’audience facultative',
              'Rien à ce jour. En cas de mise en place, uniquement avec votre consentement recueilli via le bandeau cookies',
              'Consentement (art. 6.1.a) — retirable à tout moment',
            ],
          ],
        },
      },
      {
        heading: 'Cookies',
        body: [
          'Ce site n’utilise aucun script publicitaire, de pistage ou de mesure d’audience. Seuls les cookies strictement nécessaires ci-dessous sont déposés ; ils ne requièrent pas de consentement car le site ne peut pas fonctionner sans eux.',
        ],
        table: {
          head: ['Cookie', 'Finalité', 'Conservation'],
          rows: [
            ['lang', 'Retient si vous consultez le site en français ou en anglais', '12 mois'],
            ['eco_consent', 'Enregistre votre choix en matière de cookies pour ne plus vous solliciter', '6 mois'],
          ],
        },
      },
      {
        heading: 'Retrait du consentement',
        body: [
          'Vous pouvez modifier ou retirer votre choix à tout moment via le lien « Gestion des cookies » présent en pied de page. Le retrait prend effet immédiatement et ne remet pas en cause les traitements antérieurs.',
        ],
      },
      {
        heading: 'Qui d’autre traite vos données',
        body: [
          'Nous faisons appel à un nombre restreint de sous-traitants, tous liés par un accord de traitement des données et autorisés à agir uniquement sur nos instructions. Nous ne vendons aucune donnée personnelle et n’en partageons aucune à des fins publicitaires.',
        ],
        table: {
          head: ['Sous-traitant', 'Rôle', 'Localisation'],
          rows: [
            [C.hostName, 'Hébergement de l’application, de la base de données et des sauvegardes', C.hostRegion],
            ['Prestataire de paiement', 'Paiement des abonnements et facturation (prévu)', 'À documenter avant le lancement'],
            ['Fournisseur d’IA', 'Génération de contenu lorsque vous utilisez les fonctions d’IA (prévu)', 'À documenter avant le lancement'],
          ],
        },
      },
      {
        heading: 'Où vos données sont stockées',
        body: [
          `Votre compte, vos contenus, vos médias et vos sauvegardes sont stockés dans l’Union européenne (${C.hostRegion}). Lorsqu’un sous-traitant est établi hors de l’UE, les transferts sont encadrés par les clauses contractuelles types de la Commission européenne ou par une décision d’adéquation, et sont documentés dans le tableau ci-dessus avant tout recours à ce sous-traitant.`,
        ],
      },
      {
        heading: 'Durées de conservation',
        bullets: [
          'Compte et contenus : pendant toute la durée de vie du compte, puis suppression dans les 90 jours suivant sa clôture, sauf export préalable de votre part.',
          'Journaux de sécurité et d’audit : 12 mois.',
          'Historique des tentatives de connexion : 12 mois.',
          'Factures et pièces comptables : conservées pendant la durée légale (généralement 10 ans).',
          'Choix en matière de cookies : 6 mois.',
          'Messages que vous nous adressez : jusqu’à 24 mois après le dernier échange.',
        ],
      },
      {
        heading: 'Comment nous les protégeons',
        bullets: [
          'Tous les échanges sont chiffrés en transit via TLS.',
          'Les mots de passe ne sont jamais stockés en clair, uniquement sous forme d’empreintes cryptographiques salées.',
          'Les valeurs sensibles telles que les identifiants d’API et les secrets de double authentification sont chiffrées au repos.',
          'Les actions sensibles exigent une ré-authentification, et la double authentification est disponible en option.',
          'L’accès aux données de production est limité aux personnes qui en ont besoin pour exploiter le service.',
        ],
      },
      {
        heading: 'Vos droits',
        body: [
          'Le RGPD vous permet d’exercer à tout moment et gratuitement les droits suivants. Écrivez à l’adresse de contact ci-dessus ; nous répondons dans un délai d’un mois et ne demandons un justificatif d’identité que lorsque nous ne pouvons réellement pas vous identifier.',
        ],
        bullets: [
          'Accès — obtenir une copie des données personnelles que nous détenons sur vous.',
          'Rectification — faire corriger des données inexactes ou incomplètes.',
          'Effacement — faire supprimer vos données, lorsqu’aucune obligation légale ne nous impose de les conserver.',
          'Limitation — demander la suspension de l’utilisation de vos données pendant l’examen d’une contestation.',
          'Portabilité — recevoir vos données dans un format structuré et lisible par machine, ou les faire transmettre à un autre prestataire.',
          'Opposition — vous opposer aux traitements fondés sur nos intérêts légitimes.',
          'Retrait du consentement — pour tout traitement consenti, sans effet sur le passé.',
          'Directives post mortem — définir le sort de vos données après votre décès.',
        ],
      },
      {
        heading: 'Réclamations',
        body: [
          `Si vous estimez que nous avons mal traité vos données, dites-le nous d’abord — nous préférons corriger. Vous avez également le droit d’introduire une réclamation auprès de votre autorité de contrôle, en l’occurrence la ${C.authority} (${C.authorityUrl}).`,
        ],
      },
      {
        heading: 'Décisions automatisées',
        body: [
          'Nous ne prenons aucune décision produisant des effets juridiques ou vous affectant de manière significative par des moyens automatisés, et nous ne réalisons aucun profilage. Les fonctions d’IA du produit génèrent du contenu à votre demande ; elles ne prennent aucune décision vous concernant.',
        ],
      },
      {
        heading: 'Mineurs',
        body: [
          'Le service s’adresse aux entreprises et à un usage professionnel. Il ne vise pas les mineurs et nous ne collectons pas sciemment de données concernant des personnes de moins de 15 ans.',
        ],
      },
      {
        heading: 'Modifications de cette politique',
        body: [
          'Cette politique peut évoluer avec le service. La date affichée en haut indique sa dernière révision, et les titulaires de comptes sont informés par e-mail des modifications importantes avant leur entrée en vigueur.',
        ],
      },
    ],
  },
}
