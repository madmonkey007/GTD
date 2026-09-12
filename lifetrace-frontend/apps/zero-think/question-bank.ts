export interface LocalizedText {
	zh: string;
	en: string;
}

export interface BankQuestion {
	id: string;
	category: string;
	categoryLabel: LocalizedText;
	question: LocalizedText;
}

export const QUESTION_BANK: BankQuestion[] = [
	// 职业发展
	{
		id: "career-1",
		category: "career",
		categoryLabel: { zh: "职业发展", en: "Career" },
		question: { zh: "我当前的核心竞争力是什么？", en: "What is my current core competency?" },
	},
	{
		id: "career-2",
		category: "career",
		categoryLabel: { zh: "职业发展", en: "Career" },
		question: { zh: "三年后我希望在哪个领域达到专家水平？", en: "In what field do I want to reach expert level in three years?" },
	},
	{
		id: "career-3",
		category: "career",
		categoryLabel: { zh: "职业发展", en: "Career" },
		question: { zh: "什么工作能让我忘记时间？", en: "What kind of work makes me lose track of time?" },
	},
	{
		id: "career-4",
		category: "career",
		categoryLabel: { zh: "职业发展", en: "Career" },
		question: { zh: "如果不受收入限制，我会选择做什么？", en: "If income were no limit, what would I choose to do?" },
	},
	{
		id: "career-5",
		category: "career",
		categoryLabel: { zh: "职业发展", en: "Career" },
		question: { zh: "我目前最需要提升的技能是什么？", en: "What skill do I most need to improve right now?" },
	},

	// 创意灵感
	{
		id: "creative-1",
		category: "creative",
		categoryLabel: { zh: "创意灵感", en: "Creativity" },
		question: { zh: "如果给十年前的自己写一封信，我会说什么？", en: "If I wrote a letter to myself ten years ago, what would I say?" },
	},
	{
		id: "creative-2",
		category: "creative",
		categoryLabel: { zh: "创意灵感", en: "Creativity" },
		question: { zh: "什么问题是我从未被问过但应该被问的？", en: "What question have I never been asked but should be?" },
	},
	{
		id: "creative-3",
		category: "creative",
		categoryLabel: { zh: "创意灵感", en: "Creativity" },
		question: { zh: "如果我要设计一个理想的一天，会是怎样的？", en: "If I were to design an ideal day, what would it look like?" },
	},
	{
		id: "creative-4",
		category: "creative",
		categoryLabel: { zh: "创意灵感", en: "Creativity" },
		question: { zh: "什么看似不可能的事情其实可能实现？", en: "What seemingly impossible thing might actually be possible?" },
	},
	{
		id: "creative-5",
		category: "creative",
		categoryLabel: { zh: "创意灵感", en: "Creativity" },
		question: { zh: "如果我要用三个词定义自己，会是哪三个？", en: "If I defined myself in three words, which three would they be?" },
	},

	// 人际关系
	{
		id: "relation-1",
		category: "relation",
		categoryLabel: { zh: "人际关系", en: "Relationships" },
		question: { zh: "谁是让我成为更好的人的关键人物？", en: "Who is the key person who made me a better person?" },
	},
	{
		id: "relation-2",
		category: "relation",
		categoryLabel: { zh: "人际关系", en: "Relationships" },
		question: { zh: "我在关系中最大的优势是什么？", en: "What is my greatest strength in relationships?" },
	},
	{
		id: "relation-3",
		category: "relation",
		categoryLabel: { zh: "人际关系", en: "Relationships" },
		question: { zh: "什么让我难以向他人敞开心扉？", en: "What makes it hard for me to open up to others?" },
	},
	{
		id: "relation-4",
		category: "relation",
		categoryLabel: { zh: "人际关系", en: "Relationships" },
		question: { zh: "我希望最亲近的人如何描述我？", en: "How do I hope the people closest to me would describe me?" },
	},
	{
		id: "relation-5",
		category: "relation",
		categoryLabel: { zh: "人际关系", en: "Relationships" },
		question: { zh: "我最近一次真诚地感谢别人是什么时候？", en: "When was the last time I sincerely thanked someone?" },
	},

	// 自我认知
	{
		id: "self-1",
		category: "self",
		categoryLabel: { zh: "自我认知", en: "Self-awareness" },
		question: { zh: "我最害怕的失败是什么？", en: "What failure do I fear most?" },
	},
	{
		id: "self-2",
		category: "self",
		categoryLabel: { zh: "自我认知", en: "Self-awareness" },
		question: { zh: "什么时候我感到最真实的自己？", en: "When do I feel most like my true self?" },
	},
	{
		id: "self-3",
		category: "self",
		categoryLabel: { zh: "自我认知", en: "Self-awareness" },
		question: { zh: "什么习惯在悄悄消耗我的能量？", en: "What habit is quietly draining my energy?" },
	},
	{
		id: "self-4",
		category: "self",
		categoryLabel: { zh: "自我认知", en: "Self-awareness" },
		question: { zh: "我一直在逃避什么责任？", en: "What responsibility have I been avoiding?" },
	},
	{
		id: "self-5",
		category: "self",
		categoryLabel: { zh: "自我认知", en: "Self-awareness" },
		question: { zh: "如果今天是最后一天，我会后悔什么？", en: "If today were my last day, what would I regret?" },
	},

	// 学习成长
	{
		id: "learn-1",
		category: "learn",
		categoryLabel: { zh: "学习成长", en: "Learning" },
		question: { zh: "我最近一次突破舒适区是什么时候？", en: "When did I last step out of my comfort zone?" },
	},
	{
		id: "learn-2",
		category: "learn",
		categoryLabel: { zh: "学习成长", en: "Learning" },
		question: { zh: "什么知识领域让我感到既兴奋又害怕？", en: "What field of knowledge excites and scares me at the same time?" },
	},
	{
		id: "learn-3",
		category: "learn",
		categoryLabel: { zh: "学习成长", en: "Learning" },
		question: { zh: "我从最近的失败中学到了什么？", en: "What have I learned from my recent failure?" },
	},
	{
		id: "learn-4",
		category: "learn",
		categoryLabel: { zh: "学习成长", en: "Learning" },
		question: { zh: "如果要教别人一件事，我会教什么？", en: "If I were to teach someone one thing, what would it be?" },
	},
	{
		id: "learn-5",
		category: "learn",
		categoryLabel: { zh: "学习成长", en: "Learning" },
		question: { zh: "什么认知偏见最常影响我的决策？", en: "What cognitive bias most often affects my decisions?" },
	},

	// 日常反思
	{
		id: "daily-1",
		category: "daily",
		categoryLabel: { zh: "日常反思", en: "Daily reflection" },
		question: { zh: "今天什么小事让我感到快乐？", en: "What small thing today made me happy?" },
	},
	{
		id: "daily-2",
		category: "daily",
		categoryLabel: { zh: "日常反思", en: "Daily reflection" },
		question: { zh: "如果重过今天，我会做什么不同的选择？", en: "If I could redo today, what would I do differently?" },
	},
	{
		id: "daily-3",
		category: "daily",
		categoryLabel: { zh: "日常反思", en: "Daily reflection" },
		question: { zh: "我今天对谁表达了善意？", en: "Who did I show kindness to today?" },
	},
	{
		id: "daily-4",
		category: "daily",
		categoryLabel: { zh: "日常反思", en: "Daily reflection" },
		question: { zh: "什么让我今天分心了？", en: "What distracted me today?" },
	},
	{
		id: "daily-5",
		category: "daily",
		categoryLabel: { zh: "日常反思", en: "Daily reflection" },
		question: { zh: "明天最重要的三件事是什么？", en: "What are the three most important things for tomorrow?" },
	},
];

export const CATEGORIES: { id: string; label: LocalizedText }[] = [
	{ id: "career", label: { zh: "职业发展", en: "Career" } },
	{ id: "creative", label: { zh: "创意灵感", en: "Creativity" } },
	{ id: "relation", label: { zh: "人际关系", en: "Relationships" } },
	{ id: "self", label: { zh: "自我认知", en: "Self-awareness" } },
	{ id: "learn", label: { zh: "学习成长", en: "Learning" } },
	{ id: "daily", label: { zh: "日常反思", en: "Daily reflection" } },
];
