import type { Catalog } from './types'

export const fr: Catalog = {
  meta: {
    htmlLang: 'fr',
    title: 'Ecobuilder — Le créateur de sites web éco-responsable',
    description:
      'Le créateur de sites tout-en-un, éco-responsable et dopé à l’IA : décrivez votre page, publiez en quelques minutes — aucune compétence web requise. Hébergement, SEO et marketing inclus, dès 29 €/mois.',
    basePath: '/fr',
    switchLabel: 'English',
    switchPath: '/en',
  },
  nav: {
    features: 'Fonctionnalités',
    eco: 'Pourquoi éco',
    pricing: 'Tarifs',
    faq: 'FAQ',
    openApp: 'Ouvrir l’app',
  },
  hero: {
    badge: 'Pensé pour l’Europe · Hébergé dans l’UE',
    title: 'Créez de beaux sites web',
    titleAccent: 'qui pèsent léger.',
    subtitle:
      'Décrivez ce dont vous avez besoin, l’IA intégrée le prépare, et vous publiez en quelques minutes — aucune connaissance web requise. Hébergement, SEO et marketing inclus dès 29 €/mois, et chaque page est livrée en HTML statique propre, léger pour la planète.',
    ctaPrimary: 'Essai gratuit de 7 jours',
    ctaSecondary: 'Voir les tarifs',
    stats: [
      { value: '~50 Ko', label: 'poids typique d’une page publiée' },
      { value: 'Minutes', label: 'de l’inscription à la mise en ligne' },
      { value: '0', label: 'compétence web requise' },
    ],
  },
  eco: {
    kicker: 'Pourquoi éco',
    title: 'L’octet le plus vert est celui qu’on n’envoie jamais.',
    body: 'Le web émet plus de CO₂ que l’aviation, et le poids des pages y est pour beaucoup. Ecobuilder s’attaque au problème à la source : le moteur de publication produit du HTML sémantique et du CSS soigné — le genre de page qu’écrirait un développeur minutieux, générée pour vous.',
    comparison: {
      title: 'Poids moyen d’une page',
      note: 'Valeurs typiques : médiane HTTP Archive contre une page marketing publiée avec Ecobuilder. Des pages plus légères, c’est moins d’énergie dans les réseaux, les serveurs et les appareils — à chaque visite.',
      bars: [
        { label: 'Page WordPress typique', value: '2,5 Mo', percent: 100 },
        { label: 'Page de site-builder typique', value: '1,8 Mo', percent: 72 },
        { label: 'Page Ecobuilder', value: '50 Ko', percent: 3, highlight: true },
      ],
    },
    points: [
      {
        title: 'Statique par défaut',
        body: 'Les pages sont générées en fichiers statiques au moment de la publication et servies en une seule lecture. Les fragments dynamiques se chargent à la demande, uniquement là où vous en avez besoin.',
      },
      {
        title: 'Aucun framework côté visiteur',
        body: 'Vos visiteurs téléchargent votre contenu, pas nos outils. Les pages publiées n’embarquent aucun JavaScript de framework — l’interactivité est optionnelle et se mesure en octets.',
      },
      {
        title: 'L’efficacité comme fonctionnalité',
        body: 'Des pages plus légères se référencent mieux, convertissent mieux et coûtent moins cher à servir. Être vert et être rapide, c’est la même décision d’ingénierie.',
      },
    ],
  },
  features: {
    kicker: 'Tout-en-un',
    title: 'L’IA fait le gros du travail. Vous gardez la main.',
    items: [
      {
        title: 'Assistant IA intégré',
        body: 'Décrivez la page dont vous avez besoin avec vos mots — l’IA propose la mise en page, rédige les textes et ajuste le design. Vous validez chaque changement avant la mise en ligne.',
      },
      {
        title: 'Simple dès la première minute',
        body: 'Pas de code, pas de configuration d’hébergement, pas de jargon web. Inscrivez-vous, choisissez un point de départ, publiez — votre site est en ligne en quelques minutes.',
      },
      {
        title: 'SEO intégré',
        body: 'HTML sémantique, sitemaps automatiques, contrôle complet des méta-données et d’Open Graph, et des pages assez rapides pour exceller aux Core Web Vitals — le travail de référencement se fait à la publication.',
      },
      {
        title: 'Outils et services marketing',
        body: 'Capture de contacts, pages prêtes pour vos campagnes et modèles orientés conversion — avec l’accompagnement SEO et marketing de notre équipe sur les offres supérieures.',
      },
      {
        title: 'Éditeur visuel',
        body: 'Concevez sur un véritable canevas visuel avec points de rupture, design tokens et composants réutilisables — ce que vous voyez est exactement ce qui est publié.',
      },
      {
        title: 'Co-édition en temps réel',
        body: 'Éditez ensemble, en direct. Chaque modification se synchronise instantanément entre les éditeurs — pas de bouton Enregistrer, pas d’écrasement, pas de « qui a le fichier ? »',
      },
      {
        title: 'HTML et CSS propres',
        body: 'Un balisage sémantique et un CSS ordonné que vous pourriez confier à un développeur sans rougir. Votre site reste le vôtre, dans un code lisible.',
      },
      {
        title: 'Contenus et tables de données',
        body: 'Articles, pages et types de contenu entièrement personnalisés avec champs typés, vues en liste et circuits de publication intégrés.',
      },
      {
        title: 'Système de plugins',
        body: 'Étendez l’éditeur et le site publié avec des plugins isolés dans un bac à sable — sûrs par construction, avec des permissions explicites.',
      },
      {
        title: 'Formulaires et médias',
        body: 'Des formulaires natifs qui écrivent directement dans vos tables de contenu, et une médiathèque avec dossiers, variantes et recherche intelligente.',
      },
    ],
  },
  europe: {
    kicker: 'Pensé pour l’Europe',
    title: 'Hébergement européen. Règles européennes.',
    body: 'Ecobuilder Cloud fonctionne sur une infrastructure européenne, et le produit est conçu pour les équipes qui prennent la protection des données au sérieux.',
    points: [
      {
        title: 'RGPD d’abord',
        body: 'Aucun script de pistage sur les pages publiées par défaut, uniquement des cookies strictement nécessaires, et un export complet de vos données quand vous le souhaitez.',
      },
      {
        title: 'Données hébergées dans l’UE',
        body: 'Vos contenus, médias et sauvegardes résident sur des serveurs situés dans l’Union européenne.',
      },
      {
        title: 'Français et anglais',
        body: 'Un produit européen pour un marché multilingue — avec une couverture complète du français et de l’anglais dès le départ.',
      },
    ],
  },
  pricing: {
    kicker: 'Tarifs',
    title: 'Des offres simples qui grandissent avec vous.',
    body: 'Une offre tout-en-un dès 29 €/mois : créateur IA, hébergement, SEO et marketing réunis — sans options payantes, sans suppléments à la carte. Économisez 25 % avec la facturation annuelle.',
    note: 'Toutes les offres commencent par un essai gratuit de 7 jours — sans carte bancaire. Prix hors TVA.',
    tiers: [
      {
        name: 'Create',
        price: '29 €',
        period: '/mois',
        billingNote: 'facturation annuelle (−25 %) — ou 39 €/mois sans engagement',
        description: 'Tout ce qu’il faut pour lancer des pages légères qui convertissent.',
        features: [
          'Pages publiées illimitées',
          '30 000 visiteurs uniques / mois',
          'Connexion de votre nom de domaine',
          'Boîte à outils SEO et sitemaps',
          'Formulaires et capture de contacts',
          'Hébergement UE et SSL inclus',
        ],
        cta: 'Essai gratuit de 7 jours',
      },
      {
        name: 'Optimize',
        price: '59 €',
        period: '/mois',
        billingNote: 'facturation annuelle (−25 %) — ou 79 €/mois sans engagement',
        description: 'Pour les équipes qui itèrent sur la conversion, à plus fort trafic.',
        features: [
          'Tout ce qui est inclus dans Create',
          '100 000 visiteurs uniques / mois',
          'Plusieurs sites et espaces de travail',
          'Audits SEO et conversion',
          'Achat de domaines directement chez nous',
          'Rôles d’équipe et support prioritaire',
        ],
        cta: 'Essai gratuit de 7 jours',
        highlight: true,
      },
      {
        name: 'Convert',
        price: 'Sur mesure',
        period: '',
        billingNote: 'contrat annuel, adapté à votre volume',
        description: 'Pour les agences et les entreprises qui publient à grande échelle.',
        features: [
          'Tout ce qui est inclus dans Optimize',
          'Visiteurs et sites illimités',
          'Accompagnement SEO et marketing dédié',
          'Intégration et migration dédiées',
          'SLA et contrats personnalisés',
        ],
        cta: 'Parler à un conseiller',
        custom: true,
      },
    ],
  },
  faq: {
    kicker: 'FAQ',
    title: 'Vos questions, nos réponses.',
    items: [
      {
        q: 'En quoi Ecobuilder diffère-t-il d’Instapage ou de Webflow ?',
        a: 'Vous retrouvez la même puissance de création visuelle et de publication — mais vos pages sont livrées en HTML statique ultra-léger, sans framework embarqué, et hébergées dans l’UE. Des pages plus rapides, un meilleur rendement publicitaire et une empreinte carbone radicalement réduite.',
      },
      {
        q: 'Qu’est-ce qui rend un site web « éco-responsable » ?',
        a: 'Surtout le poids et le travail : moins d’octets transférés et moins de calcul par visite, c’est moins d’énergie dans les centres de données, les réseaux et les appareils des visiteurs. Ecobuilder minimise les deux dès la conception.',
      },
      {
        q: 'Faut-il des compétences techniques ou web ?',
        a: 'Aucune. Décrivez ce que vous voulez et l’assistant IA le prépare ; l’éditeur visuel fonctionne comme un outil de design, et l’hébergement, les domaines et le SSL sont gérés pour vous. Si vous savez écrire un e-mail, vous savez publier un site.',
      },
      {
        q: 'Le SEO et le marketing sont-ils vraiment inclus ?',
        a: 'Oui — chaque offre est tout-en-un. Le SEO technique (balisage propre, sitemaps, contrôle des méta-données, pages rapides) est intégré au produit, et les offres Optimize et Convert ajoutent des audits SEO et un accompagnement marketing par notre équipe.',
      },
      {
        q: 'Puis-je utiliser mon propre nom de domaine ?',
        a: 'Oui — connectez un domaine que vous possédez déjà en quelques clics, ou achetez-en un directement chez nous et nous configurons tout automatiquement.',
      },
      {
        q: 'Y a-t-il un essai gratuit ?',
        a: 'Oui — chaque offre commence par un essai gratuit de 7 jours, sans carte bancaire. Créez et publiez une vraie page avant de vous décider.',
      },
      {
        q: 'Mon équipe peut-elle éditer à plusieurs ?',
        a: 'Oui — la co-édition en temps réel fait partie du cœur du produit. Chacun voit les modifications des autres en direct, comme dans un outil de design.',
      },
    ],
  },
  ctaBand: {
    title: 'Prêt à construire plus léger ?',
    body: 'Publiez un site dont vous êtes fier — et que la planète remarque à peine.',
    cta: 'Démarrer l’essai gratuit',
  },
  footer: {
    tagline: 'Le créateur éco-responsable de pages d’atterrissage et de sites web.',
    product: 'Produit',
    legal: 'Mentions',
    privacy: 'Politique de confidentialité',
    imprint: 'Mentions légales',
    hostedInEu: 'Fièrement hébergé dans l’Union européenne 🇪🇺',
  },
}
