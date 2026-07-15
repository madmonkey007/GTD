export interface BankQuestion {
	id: string;
	category: string;
	categoryLabel: string;
	question: string;
}

export const QUESTION_BANK: BankQuestion[] = [
	// 职业发展
	{
		id: "career-1",
		category: "career",
		categoryLabel: "职业发展",
		question: "我当前的核心竞争力是什么？",
	},
	{
		id: "career-2",
		category: "career",
		categoryLabel: "职业发展",
		question: "三年后我希望在哪个领域达到专家水平？",
	},
	{
		id: "career-3",
		category: "career",
		categoryLabel: "职业发展",
		question: "什么工作能让我忘记时间？",
	},
	{
		id: "career-4",
		category: "career",
		categoryLabel: "职业发展",
		question: "如果不受收入限制，我会选择做什么？",
	},
	{
		id: "career-5",
		category: "career",
		categoryLabel: "职业发展",
		question: "我目前最需要提升的技能是什么？",
	},

	// 创意灵感
	{
		id: "creative-1",
		category: "creative",
		categoryLabel: "创意灵感",
		question: "如果给十年前的自己写一封信，我会说什么？",
	},
	{
		id: "creative-2",
		category: "creative",
		categoryLabel: "创意灵感",
		question: "什么问题是我从未被问过但应该被问的？",
	},
	{
		id: "creative-3",
		category: "creative",
		categoryLabel: "创意灵感",
		question: "如果我要设计一个理想的一天，会是怎样的？",
	},
	{
		id: "creative-4",
		category: "creative",
		categoryLabel: "创意灵感",
		question: "什么看似不可能的事情其实可能实现？",
	},
	{
		id: "creative-5",
		category: "creative",
		categoryLabel: "创意灵感",
		question: "如果我要用三个词定义自己，会是哪三个？",
	},

	// 人际关系
	{
		id: "relation-1",
		category: "relation",
		categoryLabel: "人际关系",
		question: "谁是让我成为更好的人的关键人物？",
	},
	{
		id: "relation-2",
		category: "relation",
		categoryLabel: "人际关系",
		question: "我在关系中最大的优势是什么？",
	},
	{
		id: "relation-3",
		category: "relation",
		categoryLabel: "人际关系",
		question: "什么让我难以向他人敞开心扉？",
	},
	{
		id: "relation-4",
		category: "relation",
		categoryLabel: "人际关系",
		question: "我希望最亲近的人如何描述我？",
	},
	{
		id: "relation-5",
		category: "relation",
		categoryLabel: "人际关系",
		question: "我最近一次真诚地感谢别人是什么时候？",
	},

	// 自我认知
	{
		id: "self-1",
		category: "self",
		categoryLabel: "自我认知",
		question: "我最害怕的失败是什么？",
	},
	{
		id: "self-2",
		category: "self",
		categoryLabel: "自我认知",
		question: "什么时候我感到最真实的自己？",
	},
	{
		id: "self-3",
		category: "self",
		categoryLabel: "自我认知",
		question: "什么习惯在悄悄消耗我的能量？",
	},
	{
		id: "self-4",
		category: "self",
		categoryLabel: "自我认知",
		question: "我一直在逃避什么责任？",
	},
	{
		id: "self-5",
		category: "self",
		categoryLabel: "自我认知",
		question: "如果今天是最后一天，我会后悔什么？",
	},

	// 学习成长
	{
		id: "learn-1",
		category: "learn",
		categoryLabel: "学习成长",
		question: "我最近一次突破舒适区是什么时候？",
	},
	{
		id: "learn-2",
		category: "learn",
		categoryLabel: "学习成长",
		question: "什么知识领域让我感到既兴奋又害怕？",
	},
	{
		id: "learn-3",
		category: "learn",
		categoryLabel: "学习成长",
		question: "我从最近的失败中学到了什么？",
	},
	{
		id: "learn-4",
		category: "learn",
		categoryLabel: "学习成长",
		question: "如果要教别人一件事，我会教什么？",
	},
	{
		id: "learn-5",
		category: "learn",
		categoryLabel: "学习成长",
		question: "什么认知偏见最常影响我的决策？",
	},

	// 日常反思
	{
		id: "daily-1",
		category: "daily",
		categoryLabel: "日常反思",
		question: "今天什么小事让我感到快乐？",
	},
	{
		id: "daily-2",
		category: "daily",
		categoryLabel: "日常反思",
		question: "如果重过今天，我会做什么不同的选择？",
	},
	{
		id: "daily-3",
		category: "daily",
		categoryLabel: "日常反思",
		question: "我今天对谁表达了善意？",
	},
	{
		id: "daily-4",
		category: "daily",
		categoryLabel: "日常反思",
		question: "什么让我今天分心了？",
	},
	{
		id: "daily-5",
		category: "daily",
		categoryLabel: "日常反思",
		question: "明天最重要的三件事是什么？",
	},
];

export const CATEGORIES = [
	{ id: "career", label: "职业发展" },
	{ id: "creative", label: "创意灵感" },
	{ id: "relation", label: "人际关系" },
	{ id: "self", label: "自我认知" },
	{ id: "learn", label: "学习成长" },
	{ id: "daily", label: "日常反思" },
];