import type { Catalog } from './types'

export const fr: Catalog = {
  meta: {
    htmlLang: 'fr',
    title: 'Ecobuilder — Le créateur de sites web éco-responsable',
    description:
      'Créez de beaux sites web qui pèsent léger. Ecobuilder est l’alternative open source et éco-responsable à Webflow, Framer et WordPress — des pages statiques propres, hébergées en Europe, sans superflu.',
    basePath: '/fr',
    switchLabel: 'English',
    switchPath: '/en',
  },
  nav: {
    features: 'Fonctionnalités',
    eco: 'Pourquoi éco',
    openSource: 'Open source',
    faq: 'FAQ',
    openApp: 'Ouvrir l’app',
  },
  hero: {
    badge: 'Open source · Hébergé dans l’UE',
    title: 'Créez de beaux sites web',
    titleAccent: 'qui pèsent léger.',
    subtitle:
      'Ecobuilder est un créateur de sites visuel qui publie du HTML et du CSS statiques, propres, dignes d’un travail artisanal. Pas de framework embarqué, pas de mégaoctets de JavaScript — seulement des pages rapides qui consomment moins d’énergie à chaque visite.',
    ctaPrimary: 'Commencer gratuitement',
    ctaSecondary: 'Voir sur GitHub',
    stats: [
      { value: '~50 Ko', label: 'poids typique d’une page publiée' },
      { value: '0', label: 'framework livré au visiteur' },
      { value: '100 %', label: 'sortie statique en priorité' },
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
    kicker: 'Fonctionnalités',
    title: 'Un vrai éditeur visuel. Un vrai CMS. Un seul outil.',
    items: [
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
  openSource: {
    kicker: 'Open source',
    title: 'Notre cloud, ou votre serveur.',
    body: 'Ecobuilder est open source. Hébergez-le sur votre propre serveur avec Docker et gardez la maîtrise de chaque octet, ou laissez-nous l’exploiter pour vous sur app.ecobuilder.ai — le même produit, le niveau de contrôle en plus.',
    ctaGithub: 'Étoile sur GitHub',
    ctaCloud: 'Essayer Ecobuilder Cloud',
  },
  faq: {
    kicker: 'FAQ',
    title: 'Vos questions, nos réponses.',
    items: [
      {
        q: 'En quoi Ecobuilder diffère-t-il de Webflow ou Framer ?',
        a: 'Ecobuilder publie du HTML et du CSS statiques sans framework embarqué, est entièrement open source et peut être auto-hébergé. Vous gardez votre contenu, votre code et votre indépendance.',
      },
      {
        q: 'Qu’est-ce qui rend un site web « éco-responsable » ?',
        a: 'Surtout le poids et le travail : moins d’octets transférés et moins de calcul par visite, c’est moins d’énergie dans les centres de données, les réseaux et les appareils des visiteurs. Ecobuilder minimise les deux dès la conception.',
      },
      {
        q: 'Puis-je utiliser mon propre nom de domaine ?',
        a: 'Oui — connectez un domaine que vous possédez déjà en quelques clics, ou achetez-en un directement chez nous et nous configurons tout automatiquement.',
      },
      {
        q: 'Est-ce vraiment gratuit pour commencer ?',
        a: 'Oui. L’auto-hébergement est gratuit pour toujours grâce à la licence open source, et Ecobuilder Cloud propose une offre gratuite pour créer et publier votre premier site.',
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
    cta: 'Commencer gratuitement',
  },
  footer: {
    tagline: 'Le créateur de sites web open source et éco-responsable.',
    product: 'Produit',
    legal: 'Mentions',
    privacy: 'Politique de confidentialité',
    imprint: 'Mentions légales',
    hostedInEu: 'Fièrement hébergé dans l’Union européenne 🇪🇺',
  },
}
