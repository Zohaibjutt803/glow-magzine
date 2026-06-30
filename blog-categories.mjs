/**
 * Blog pillar categories — SEO landing pages at /category/{slug}/
 * Posts map here via Contentful category reference or slugified category name.
 * toolCategory links archive pages to related free tools.
 */
export const BLOG_CATEGORIES = [
	{
		slug: 'health',
		name: 'Health',
		title: 'Health Articles & Guides — Tips, Wellness & Fitness | Glow Magzine',
		desc: 'Read health tips, nutrition guides, fitness advice and wellness articles. Expert how-tos paired with free health calculators.',
		blurb: 'Wellness, fitness, nutrition and everyday health advice.',
		toolCategory: 'health',
	},
	{
		slug: 'beauty',
		name: 'Beauty',
		title: 'Beauty Tips & Style Guides | Glow Magzine',
		desc: 'Skincare, makeup, hair and style guides plus free beauty tools — skin type quizzes, shade finders and more.',
		blurb: 'Skincare, makeup, hair and personal style.',
		toolCategory: 'beauty',
	},
	{
		slug: 'womens-health',
		name: "Women's Health",
		title: "Women's Health Articles & Guides | Glow Magzine",
		desc: 'Period, fertility, pregnancy and women\'s wellness articles with free private calculators.',
		blurb: 'Period, fertility, pregnancy and women\'s wellness.',
		toolCategory: 'womens-health',
	},
	{
		slug: 'finance',
		name: 'Finance',
		title: 'Personal Finance Tips & Guides | Glow Magzine',
		desc: 'Budgeting, loans, savings and money guides paired with free EMI, loan and currency calculators.',
		blurb: 'Personal finance, budgeting and smart money habits.',
		toolCategory: 'finance',
	},
	{
		slug: 'lifestyle',
		name: 'Lifestyle',
		title: 'Lifestyle Tips & How-To Guides | Glow Magzine',
		desc: 'Productivity, travel, home and everyday lifestyle tips with free tools to simplify daily tasks.',
		blurb: 'Productivity, travel, home and everyday living.',
		toolCategory: 'daily',
	},
	{
		slug: 'nutrition',
		name: 'Nutrition',
		title: 'Nutrition Guides & Diet Tips | Glow Magzine',
		desc: 'Protein, macros, meal planning and nutrition how-tos with free intake calculators.',
		blurb: 'Macros, meal planning and balanced eating.',
		toolCategory: 'nutrition',
	},
	{
		slug: 'online-tools',
		name: 'Online Tools',
		title: 'Free Online Tools & Calculator Guides | Glow Magzine',
		desc: 'How-to guides for free online tools, calculators, converters and generators — get more from Glow Magzine.',
		blurb: 'Guides for using free calculators and web tools.',
		toolCategory: 'utilities',
	},
	{
		slug: 'how-to-guides',
		name: 'How-To Guides',
		title: 'How-To Guides & Tutorials | Glow Magzine',
		desc: 'Step-by-step how-to guides and tutorials on health, beauty, finance and everyday productivity.',
		blurb: 'Step-by-step tutorials and practical guides.',
	},
];

export const CATEGORY_ALIASES = {
	'test': 'online-tools',
	'guides': 'how-to-guides',
	'tutorials': 'how-to-guides',
	'wellness': 'health',
	'money': 'finance',
	'personal-finance': 'finance',
};
