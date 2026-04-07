import { useState, useMemo } from 'react'
import {
  LayoutTemplate, Search,
  TrendingUp, DollarSign, Settings, FileText, Lightbulb, BarChart2,
  Megaphone, Mail, Palette, MailOpen, Rocket, Users,
  BookOpen, Type, Share2, Video, Ghost, Paintbrush,
  GraduationCap, CheckSquare, Newspaper, BarChart3,
  Code2, GitMerge, Server, Shield, TestTube, FileCode, Database,
  PiggyBank, LineChart, Receipt, Bitcoin,
  Scale, Lock,
  Target, MessageSquare,
  UserCheck, ClipboardList,
  Headphones, Star, AlertCircle,
  Globe, Layout,
  Dumbbell, Heart, Moon, Leaf,
  Home, Calculator,
  ShoppingBag, Tag, Package,
  Edit3, Link,
  PieChart, Code,
  Calendar, Filter,
  Briefcase, Map, ShoppingCart,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../store/appStore'

// ─── Types ────────────────────────────────────────────────────────────────────

type LucideIcon = typeof Search

interface AgentTemplate {
  id: string
  name: string
  category: string
  description: string
  model: string
  color: string
  Icon: LucideIcon
  task: string
}

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Business',
  'Marketing',
  'Content & Creative',
  'Research',
  'Engineering',
  'Finance',
  'Legal',
  'Sales',
  'HR & Recruiting',
  'Customer Support',
  'Education',
  'Health & Wellness',
  'Real Estate',
  'E-commerce',
  'Social Media',
  'SEO',
  'Data & Analytics',
  'Productivity',
  'Personal',
]

const CATEGORY_COLORS: Record<string, string> = {
  Business: '#7f77dd',
  Marketing: '#f97316',
  'Content & Creative': '#e1306c',
  Research: '#4285f4',
  Engineering: '#1d9e75',
  Finance: '#f59e0b',
  Legal: '#6366f1',
  Sales: '#ec4899',
  'HR & Recruiting': '#a855f7',
  'Customer Support': '#229ed9',
  Education: '#0ea5e9',
  'Health & Wellness': '#22c55e',
  'Real Estate': '#84cc16',
  'E-commerce': '#635bff',
  'Social Media': '#e1306c',
  SEO: '#ff7000',
  'Data & Analytics': '#06b6d4',
  Productivity: '#8b5cf6',
  Personal: '#f43f5e',
}

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: AgentTemplate[] = [
  // Business
  { id: 'ceo-advisor', name: 'CEO Advisor', category: 'Business', description: 'Acts as a strategic C-suite advisor. Helps with vision, decision-making, board communications, and business strategy.', model: 'your active model', color: '#7f77dd', Icon: TrendingUp, task: 'Act as my strategic CEO advisor. Help me with vision setting, major decisions, board communications, and overall business strategy. Be direct and think long-term.' },
  { id: 'cfo-advisor', name: 'CFO Advisor', category: 'Business', description: 'Financial strategy, cash flow analysis, budgeting, forecasting, and investor reporting.', model: 'your active model', color: '#7f77dd', Icon: DollarSign, task: 'Act as my CFO advisor. Help me with financial strategy, cash flow, budgeting, forecasting, and investor reporting. Focus on the numbers and what they mean for the business.' },
  { id: 'coo-advisor', name: 'COO Advisor', category: 'Business', description: 'Operations optimization, process design, team structure, and execution planning.', model: 'your active model', color: '#7f77dd', Icon: Settings, task: 'Act as my COO advisor. Help me optimize operations, design efficient processes, structure my team, and build execution plans that scale.' },
  { id: 'business-plan', name: 'Business Plan Writer', category: 'Business', description: 'Creates comprehensive business plans with market analysis, financial projections, and go-to-market strategy.', model: 'your active model', color: '#7f77dd', Icon: FileText, task: 'Help me write a comprehensive business plan. Include market analysis, competitive landscape, financial projections, and a detailed go-to-market strategy.' },
  { id: 'startup-mentor', name: 'Startup Mentor', category: 'Business', description: 'Advises early-stage founders on product-market fit, fundraising, hiring, and growth.', model: 'your active model', color: '#7f77dd', Icon: Lightbulb, task: 'Act as my startup mentor. Guide me on product-market fit, fundraising strategy, early hiring decisions, and sustainable growth. Be honest and practical.' },
  { id: 'competitive-intel', name: 'Competitive Intelligence', category: 'Business', description: 'Researches competitors, analyzes positioning, and produces battlecards and SWOT analyses.', model: 'your active model', color: '#7f77dd', Icon: BarChart2, task: 'Research my competitors, analyze their positioning, and help me build SWOT analyses and competitive battlecards I can use with my sales and product teams.' },

  // Marketing
  { id: 'cmo-advisor', name: 'CMO Advisor', category: 'Marketing', description: 'Full-stack marketing strategy, brand positioning, channel mix, and campaign planning.', model: 'your active model', color: '#f97316', Icon: Megaphone, task: 'Act as my CMO. Help me build a full marketing strategy — brand positioning, channel selection, budget allocation, and campaign planning.' },
  { id: 'campaign-manager', name: 'Campaign Manager', category: 'Marketing', description: 'Plans and executes multi-channel marketing campaigns with copy, targeting, and KPI tracking.', model: 'your active model', color: '#f97316', Icon: BarChart3, task: 'Help me plan and execute a multi-channel marketing campaign. Define targeting, write copy variants, set KPIs, and create a tracking framework.' },
  { id: 'brand-strategist', name: 'Brand Strategist', category: 'Marketing', description: 'Develops brand identity, voice, messaging frameworks, and positioning statements.', model: 'your active model', color: '#f97316', Icon: Palette, task: 'Help me develop my brand identity — voice, tone, messaging framework, and a clear positioning statement that differentiates me in the market.' },
  { id: 'email-marketer', name: 'Email Marketer', category: 'Marketing', description: 'Writes email sequences, nurture campaigns, subject lines, and A/B test variants.', model: 'your active model', color: '#f97316', Icon: Mail, task: 'Write compelling email sequences and nurture campaigns. Include strong subject lines, A/B test variants, and optimize for open and conversion rates.' },
  { id: 'growth-hacker', name: 'Growth Hacker', category: 'Marketing', description: 'Identifies growth loops, runs experiments, and finds unconventional acquisition channels.', model: 'your active model', color: '#f97316', Icon: Rocket, task: 'Help me identify growth loops, design rapid experiments, and find unconventional acquisition channels. Think creatively and data-driven.' },
  { id: 'market-researcher', name: 'Market Researcher', category: 'Marketing', description: 'Conducts market research, surveys analysis, TAM/SAM/SOM calculations, and trend reports.', model: 'your active model', color: '#f97316', Icon: Users, task: 'Conduct thorough market research for my business. Calculate TAM/SAM/SOM, analyze trends, and produce a structured research report with actionable insights.' },

  // Content & Creative
  { id: 'content-strategist', name: 'Content Strategist', category: 'Content & Creative', description: 'Plans editorial calendars, content pillars, distribution strategy, and repurposing frameworks.', model: 'your active model', color: '#e1306c', Icon: Layout, task: 'Build me a content strategy — editorial calendar, content pillars, distribution channels, and a framework for repurposing content across platforms.' },
  { id: 'blog-writer', name: 'Blog Writer', category: 'Content & Creative', description: 'Researches and writes long-form SEO blog posts, articles, and thought leadership content.', model: 'your active model', color: '#e1306c', Icon: BookOpen, task: 'Write high-quality, SEO-optimized long-form blog posts and articles. Research the topic thoroughly and write in an engaging, authoritative voice.' },
  { id: 'copywriter', name: 'Copywriter', category: 'Content & Creative', description: 'Writes high-converting landing page copy, ads, headlines, and value propositions.', model: 'your active model', color: '#e1306c', Icon: Type, task: 'Write high-converting copy — landing pages, ad copy, headlines, and value propositions that speak directly to customer pain points and drive action.' },
  { id: 'social-media-manager', name: 'Social Media Manager', category: 'Content & Creative', description: 'Creates platform-specific posts, captions, hashtag strategies, and content calendars.', model: 'your active model', color: '#e1306c', Icon: Share2, task: 'Manage my social media content. Create platform-specific posts, captions, hashtag strategies, and a content calendar that builds engagement and following.' },
  { id: 'video-script', name: 'Video Script Writer', category: 'Content & Creative', description: 'Writes YouTube scripts, TikTok hooks, explainer videos, and podcast outlines.', model: 'your active model', color: '#e1306c', Icon: Video, task: 'Write compelling video scripts — YouTube long-form, TikTok hooks, explainer videos, and podcast episode outlines with strong openings and clear structure.' },
  { id: 'ghostwriter', name: 'Ghostwriter', category: 'Content & Creative', description: 'Writes in your voice — articles, LinkedIn posts, books, speeches, and newsletters.', model: 'your active model', color: '#e1306c', Icon: Ghost, task: 'Ghost-write content in my voice. First, ask me about my tone, style, and audience. Then write articles, LinkedIn posts, newsletters, or speeches that sound authentically like me.' },
  { id: 'creative-director', name: 'Creative Director', category: 'Content & Creative', description: 'Provides creative direction for campaigns, content, and brand storytelling.', model: 'your active model', color: '#e1306c', Icon: Paintbrush, task: 'Act as my creative director. Provide creative direction for campaigns, review content concepts, and guide our brand storytelling to be more compelling and memorable.' },

  // Research
  { id: 'research-analyst', name: 'Research Analyst', category: 'Research', description: 'Deep research on any topic — compiles sources, synthesizes findings, and produces structured reports.', model: 'your active model', color: '#4285f4', Icon: Search, task: 'Research any topic I give you in depth. Compile sources, synthesize the most important findings, and produce a structured, comprehensive report with clear conclusions.' },
  { id: 'academic-researcher', name: 'Academic Researcher', category: 'Research', description: 'Literature reviews, citation analysis, methodology design, and academic writing.', model: 'your active model', color: '#4285f4', Icon: GraduationCap, task: 'Help me with academic research — conduct literature reviews, analyze citations, suggest methodology, and assist with rigorous academic writing.' },
  { id: 'fact-checker', name: 'Fact Checker', category: 'Research', description: 'Verifies claims, cross-references sources, and flags misinformation.', model: 'your active model', color: '#4285f4', Icon: CheckSquare, task: 'Fact-check any claims I give you. Cross-reference with reliable sources, flag potential misinformation, and give me a clear verdict on accuracy.' },
  { id: 'news-monitor', name: 'News Monitor', category: 'Research', description: 'Tracks topics, summarizes daily news, and surfaces relevant developments.', model: 'your active model', color: '#4285f4', Icon: Newspaper, task: 'Monitor news on topics I care about. Summarize the most important daily developments, surface emerging trends, and flag anything that needs my attention.' },
  { id: 'survey-analyst', name: 'Survey Analyst', category: 'Research', description: 'Designs surveys, analyzes results, and extracts actionable insights.', model: 'your active model', color: '#4285f4', Icon: BarChart2, task: 'Design surveys, analyze results, and extract the most actionable insights. Help me turn raw data into clear conclusions and recommendations.' },

  // Engineering
  { id: 'software-architect', name: 'Senior Software Architect', category: 'Engineering', description: 'Designs system architecture, reviews technical decisions, and produces architecture diagrams and ADRs.', model: 'your active model', color: '#1d9e75', Icon: Code2, task: 'Act as my senior software architect. Design system architecture, review technical decisions, write ADRs, and help me make the right technical trade-offs.' },
  { id: 'fullstack-dev', name: 'Full Stack Developer', category: 'Engineering', description: 'Implements features across frontend and backend with clean, production-ready code.', model: 'your active model', color: '#1d9e75', Icon: Layout, task: 'Implement features across the full stack. Write clean, production-ready code with proper error handling, tests, and documentation.' },
  { id: 'code-reviewer', name: 'Code Reviewer', category: 'Engineering', description: 'Reviews pull requests for bugs, security issues, performance, and code quality.', model: 'your active model', color: '#1d9e75', Icon: GitMerge, task: 'Review my code thoroughly. Look for bugs, security vulnerabilities, performance issues, and code quality improvements. Be specific and constructive.' },
  { id: 'devops-engineer', name: 'DevOps Engineer', category: 'Engineering', description: 'Designs CI/CD pipelines, Kubernetes configs, Terraform, and infrastructure automation.', model: 'your active model', color: '#1d9e75', Icon: Server, task: 'Help me design and implement DevOps infrastructure — CI/CD pipelines, Kubernetes configurations, Terraform scripts, and automation workflows.' },
  { id: 'security-auditor', name: 'Security Auditor', category: 'Engineering', description: 'Identifies vulnerabilities, reviews code for OWASP issues, and produces security reports.', model: 'your active model', color: '#1d9e75', Icon: Shield, task: 'Audit my code and infrastructure for security vulnerabilities. Check for OWASP issues, insecure configurations, and produce a prioritized security report.' },
  { id: 'qa-engineer', name: 'QA Engineer', category: 'Engineering', description: 'Creates test plans, writes automated tests, and finds edge cases.', model: 'your active model', color: '#1d9e75', Icon: TestTube, task: 'Help me with QA — create comprehensive test plans, write automated tests, and think through edge cases and failure scenarios I might have missed.' },
  { id: 'technical-writer', name: 'Technical Writer', category: 'Engineering', description: 'Writes API docs, READMEs, runbooks, and developer guides.', model: 'your active model', color: '#1d9e75', Icon: FileCode, task: 'Write clear technical documentation — API references, READMEs, runbooks, and developer guides that help users understand and use the system effectively.' },
  { id: 'db-architect', name: 'Database Architect', category: 'Engineering', description: 'Designs schemas, optimizes queries, writes migrations, and advises on database selection.', model: 'your active model', color: '#1d9e75', Icon: Database, task: 'Help me design and optimize my database. Review schemas, optimize slow queries, write clean migrations, and advise on the best database technology for my use case.' },

  // Finance
  { id: 'financial-analyst', name: 'Financial Analyst', category: 'Finance', description: 'DCF models, financial statement analysis, valuation, and investment memos.', model: 'your active model', color: '#f59e0b', Icon: LineChart, task: 'Perform financial analysis — build DCF models, analyze financial statements, calculate valuations, and write investment memos with clear recommendations.' },
  { id: 'personal-finance', name: 'Personal Finance Advisor', category: 'Finance', description: 'Budgeting, debt payoff strategies, savings plans, and financial goal setting.', model: 'your active model', color: '#f59e0b', Icon: PiggyBank, task: 'Help me with my personal finances. Create a budget, prioritize debt payoff, build a savings plan, and set concrete financial goals with a timeline.' },
  { id: 'saas-metrics', name: 'SaaS Metrics Coach', category: 'Finance', description: 'Tracks ARR, MRR, churn, LTV, CAC, and advises on SaaS financial health.', model: 'your active model', color: '#f59e0b', Icon: BarChart2, task: 'Help me understand and improve my SaaS metrics — ARR, MRR, churn rate, LTV, and CAC. Diagnose issues and recommend specific improvements.' },
  { id: 'tax-advisor', name: 'Tax Advisor', category: 'Finance', description: 'General tax strategy, deduction identification, and quarterly planning guidance.', model: 'your active model', color: '#f59e0b', Icon: Receipt, task: 'Help me with tax strategy — identify deductions I might be missing, plan for quarterly taxes, and optimize my tax position. General guidance only, not legal advice.' },
  { id: 'crypto-analyst', name: 'Crypto Analyst', category: 'Finance', description: 'Analyzes crypto markets, DeFi protocols, and blockchain project fundamentals.', model: 'your active model', color: '#f59e0b', Icon: Bitcoin, task: 'Analyze crypto markets and blockchain projects. Review fundamentals, tokenomics, DeFi protocols, and market dynamics to help me make more informed decisions.' },

  // Legal
  { id: 'contract-reviewer', name: 'Contract Reviewer', category: 'Legal', description: 'Reviews contracts for risk, unusual clauses, and missing protections. Not legal advice.', model: 'your active model', color: '#6366f1', Icon: Scale, task: 'Review this contract for risk, unusual or one-sided clauses, and missing protections. Flag anything concerning and suggest better language. Not legal advice.' },
  { id: 'legal-researcher', name: 'Legal Researcher', category: 'Legal', description: 'Researches case law, statutes, and regulations on any topic. Not legal advice.', model: 'your active model', color: '#6366f1', Icon: BookOpen, task: 'Research the legal landscape on a topic I give you — relevant case law, statutes, and regulations. Produce a structured summary. Not legal advice.' },
  { id: 'privacy-officer', name: 'Privacy Officer', category: 'Legal', description: 'GDPR, CCPA, and data privacy compliance reviews and policy drafting.', model: 'your active model', color: '#6366f1', Icon: Lock, task: 'Help me with data privacy compliance — review my practices against GDPR and CCPA requirements, draft privacy policies, and identify gaps in my data handling.' },
  { id: 'ip-advisor', name: 'IP Advisor', category: 'Legal', description: 'Trademark, copyright, and patent strategy guidance. Not legal advice.', model: 'your active model', color: '#6366f1', Icon: Lightbulb, task: 'Advise me on intellectual property strategy — trademark, copyright, and patent considerations for my work. General guidance only, not legal advice.' },

  // Sales
  { id: 'sales-coach', name: 'Sales Coach', category: 'Sales', description: 'Trains on objection handling, discovery questions, closing techniques, and deal strategy.', model: 'your active model', color: '#ec4899', Icon: Target, task: 'Coach me on sales. Help me with objection handling, powerful discovery questions, closing techniques, and how to approach specific deals I am working on.' },
  { id: 'cold-outreach', name: 'Cold Outreach Specialist', category: 'Sales', description: 'Writes personalized cold emails, LinkedIn messages, and outreach sequences.', model: 'your active model', color: '#ec4899', Icon: MailOpen, task: 'Write highly personalized cold outreach — emails, LinkedIn messages, and multi-step sequences that feel human, relevant, and drive replies.' },
  { id: 'sales-strategist', name: 'Sales Strategist', category: 'Sales', description: 'Pipeline analysis, territory planning, quota modeling, and revenue forecasting.', model: 'your active model', color: '#ec4899', Icon: TrendingUp, task: 'Help me with sales strategy — analyze my pipeline, plan territories, model quotas, and build accurate revenue forecasts I can present to leadership.' },
  { id: 'proposal-writer', name: 'Proposal Writer', category: 'Sales', description: 'Creates compelling sales proposals, RFP responses, and pitch decks.', model: 'your active model', color: '#ec4899', Icon: FileText, task: 'Write a compelling sales proposal or RFP response. Make it specific to the prospect, clearly articulate value, and have a strong call to action.' },
  { id: 'crm-analyst', name: 'CRM Analyst', category: 'Sales', description: 'Analyzes CRM data, identifies trends, and recommends pipeline improvements.', model: 'your active model', color: '#ec4899', Icon: Database, task: 'Analyze my CRM data, identify trends and patterns in my pipeline, and recommend specific improvements to increase conversion rates and deal velocity.' },

  // HR & Recruiting
  { id: 'recruiter', name: 'Recruiter', category: 'HR & Recruiting', description: 'Writes job descriptions, screens candidates, and designs interview processes.', model: 'your active model', color: '#a855f7', Icon: Users, task: 'Help me recruit top talent — write compelling job descriptions, design structured interview processes, and help me evaluate and screen candidates effectively.' },
  { id: 'hr-advisor', name: 'HR Advisor', category: 'HR & Recruiting', description: 'Employee relations, performance management, compensation strategy, and culture building.', model: 'your active model', color: '#a855f7', Icon: UserCheck, task: 'Act as my HR advisor. Help me with employee relations, performance management frameworks, compensation strategy, and building a strong team culture.' },
  { id: 'interview-coach', name: 'Interview Coach', category: 'HR & Recruiting', description: 'Preps candidates for interviews with mock questions, feedback, and strategy.', model: 'your active model', color: '#a855f7', Icon: MessageSquare, task: 'Coach me for my upcoming job interview. Run mock interviews, give honest feedback on my answers, and help me tell compelling stories about my experience.' },
  { id: 'onboarding-designer', name: 'Onboarding Designer', category: 'HR & Recruiting', description: 'Creates employee onboarding plans, checklists, and 30/60/90-day frameworks.', model: 'your active model', color: '#a855f7', Icon: ClipboardList, task: 'Design a comprehensive employee onboarding experience — welcome plan, first-week checklist, and 30/60/90-day framework to set new hires up for success.' },

  // Customer Support
  { id: 'support-agent', name: 'Support Agent', category: 'Customer Support', description: 'Handles customer inquiries, resolves issues, and drafts empathetic responses.', model: 'your active model', color: '#229ed9', Icon: Headphones, task: 'Help me handle customer support. Draft empathetic, clear responses to customer inquiries and complaints. Always aim to resolve the issue and leave the customer feeling heard.' },
  { id: 'customer-success', name: 'Customer Success Manager', category: 'Customer Support', description: 'Builds success plans, handles renewals, and proactively prevents churn.', model: 'your active model', color: '#229ed9', Icon: Star, task: 'Act as my customer success manager. Help me build customer success plans, prepare for renewal conversations, and proactively identify accounts at risk of churn.' },
  { id: 'complaint-handler', name: 'Complaint Handler', category: 'Customer Support', description: 'De-escalates difficult customer situations and finds win-win resolutions.', model: 'your active model', color: '#229ed9', Icon: AlertCircle, task: 'Help me de-escalate difficult customer situations. Draft responses that acknowledge the issue, take responsibility where appropriate, and propose clear resolutions.' },

  // Education
  { id: 'tutor', name: 'Tutor', category: 'Education', description: 'Explains any subject at any level with patience, examples, and Socratic questioning.', model: 'your active model', color: '#0ea5e9', Icon: GraduationCap, task: 'Be my tutor. Explain any topic I ask about clearly, use real-world examples, ask Socratic questions to check my understanding, and adapt to my level.' },
  { id: 'curriculum-designer', name: 'Curriculum Designer', category: 'Education', description: 'Designs course structures, learning objectives, and educational content.', model: 'your active model', color: '#0ea5e9', Icon: Layout, task: 'Design a comprehensive curriculum or course. Define clear learning objectives, structure the content logically, and create engaging educational materials.' },
  { id: 'study-coach', name: 'Study Coach', category: 'Education', description: 'Creates study plans, summarizes material, generates practice questions and flashcards.', model: 'your active model', color: '#0ea5e9', Icon: BookOpen, task: 'Help me study more effectively. Create a structured study plan, summarize key material, generate practice questions, and create flashcards for spaced repetition.' },
  { id: 'language-teacher', name: 'Language Teacher', category: 'Education', description: 'Teaches any language through conversation, correction, and structured exercises.', model: 'your active model', color: '#0ea5e9', Icon: Globe, task: 'Teach me a language I want to learn. Start by assessing my level, then teach through conversation, correct my mistakes kindly, and provide structured exercises.' },

  // Health & Wellness
  { id: 'fitness-coach', name: 'Fitness Coach', category: 'Health & Wellness', description: 'Creates workout plans, tracks progress, and advises on training methodology.', model: 'your active model', color: '#22c55e', Icon: Dumbbell, task: 'Create a personalized workout plan based on my goals and current fitness level. Advise on exercise form, progressive overload, and recovery strategies.' },
  { id: 'nutrition-advisor', name: 'Nutrition Advisor', category: 'Health & Wellness', description: 'Meal planning, macro tracking, dietary guidance, and recipe suggestions. Not medical advice.', model: 'your active model', color: '#22c55e', Icon: Leaf, task: 'Help me with nutrition planning. Create meal plans, advise on macros, suggest healthy recipes, and help me build sustainable eating habits. Not medical advice.' },
  { id: 'wellness-coach', name: 'Mental Wellness Coach', category: 'Health & Wellness', description: 'Mindfulness, stress management, journaling prompts, and habit building. Not therapy.', model: 'your active model', color: '#22c55e', Icon: Heart, task: 'Support my mental wellness. Guide me through mindfulness practices, stress management techniques, journaling prompts, and habit-building strategies. Not therapy.' },
  { id: 'sleep-coach', name: 'Sleep Coach', category: 'Health & Wellness', description: 'Sleep hygiene, schedule optimization, and evidence-based sleep improvement strategies.', model: 'your active model', color: '#22c55e', Icon: Moon, task: 'Help me improve my sleep. Assess my current sleep habits, recommend evidence-based improvements, and create an optimized sleep schedule and bedtime routine.' },

  // Real Estate
  { id: 'real-estate-analyst', name: 'Real Estate Analyst', category: 'Real Estate', description: 'Property valuation, market analysis, investment metrics (cap rate, ROI, cash-on-cash).', model: 'your active model', color: '#84cc16', Icon: Home, task: 'Analyze real estate investments for me. Calculate cap rate, ROI, cash-on-cash return, and help me evaluate whether a deal makes financial sense.' },
  { id: 'listing-copywriter', name: 'Listing Copywriter', category: 'Real Estate', description: 'Writes compelling property listings, descriptions, and marketing materials.', model: 'your active model', color: '#84cc16', Icon: FileText, task: 'Write compelling real estate listings. Highlight the property\'s best features, create an emotional connection for buyers, and make it stand out from competing listings.' },
  { id: 'deal-analyzer', name: 'Deal Analyzer', category: 'Real Estate', description: 'Analyzes real estate deals, runs numbers, and identifies risks and opportunities.', model: 'your active model', color: '#84cc16', Icon: Calculator, task: 'Analyze this real estate deal thoroughly. Run all the numbers, identify risks and opportunities, and give me a clear buy/pass recommendation with reasoning.' },

  // E-commerce
  { id: 'product-listing', name: 'Product Listing Writer', category: 'E-commerce', description: 'Writes optimized product titles, descriptions, and bullet points for Amazon, Shopify, etc.', model: 'your active model', color: '#635bff', Icon: ShoppingBag, task: 'Write optimized product listings for my e-commerce store. Create compelling titles, detailed descriptions, and benefit-focused bullet points that drive conversions.' },
  { id: 'pricing-strategist', name: 'Pricing Strategist', category: 'E-commerce', description: 'Analyzes pricing, competitor positioning, and recommends pricing strategy.', model: 'your active model', color: '#635bff', Icon: Tag, task: 'Help me develop my pricing strategy. Analyze my costs, competitive positioning, and customer value perception to find the optimal price points.' },
  { id: 'review-analyst', name: 'Review Analyst', category: 'E-commerce', description: 'Analyzes customer reviews to extract insights, sentiment, and product improvement ideas.', model: 'your active model', color: '#635bff', Icon: MessageSquare, task: 'Analyze my customer reviews to extract key insights — common complaints, praise patterns, sentiment trends, and specific product improvements customers want.' },
  { id: 'inventory-planner', name: 'Inventory Planner', category: 'E-commerce', description: 'Forecasts demand, optimizes stock levels, and prevents stockouts and overstock.', model: 'your active model', color: '#635bff', Icon: Package, task: 'Help me optimize inventory planning. Forecast demand, set reorder points, identify slow-moving stock, and prevent both stockouts and costly overstock situations.' },

  // Social Media
  { id: 'instagram-strategist', name: 'Instagram Strategist', category: 'Social Media', description: 'Grows Instagram presence with content strategy, engagement tactics, and Reels ideas.', model: 'your active model', color: '#e1306c', Icon: Share2, task: 'Help me grow my Instagram. Develop a content strategy, suggest Reels concepts, write captions, and advise on engagement tactics to build a real audience.' },
  { id: 'linkedin-creator', name: 'LinkedIn Creator', category: 'Social Media', description: 'Writes viral LinkedIn posts, thought leadership content, and profile optimization.', model: 'your active model', color: '#e1306c', Icon: Users, task: 'Help me build my LinkedIn presence. Write posts that drive engagement, develop thought leadership content, and optimize my profile to attract opportunities.' },
  { id: 'twitter-strategist', name: 'Twitter/X Strategist', category: 'Social Media', description: 'Crafts threads, growing a following, and building engagement on Twitter/X.', model: 'your active model', color: '#e1306c', Icon: MessageSquare, task: 'Help me grow on Twitter/X. Write compelling threads, develop a posting strategy, and help me build engagement and grow a relevant following.' },

  // SEO
  { id: 'seo-strategist', name: 'SEO Strategist', category: 'SEO', description: 'Keyword research, content gap analysis, technical SEO audits, and link building strategy.', model: 'your active model', color: '#ff7000', Icon: Search, task: 'Build a comprehensive SEO strategy for my website. Conduct keyword research, identify content gaps, audit technical SEO issues, and plan link building.' },
  { id: 'on-page-optimizer', name: 'On-Page Optimizer', category: 'SEO', description: 'Optimizes existing content for search — titles, meta, headers, internal links, readability.', model: 'your active model', color: '#ff7000', Icon: Edit3, task: 'Optimize my existing content for search engines. Improve titles, meta descriptions, headers, internal linking, and readability to boost rankings.' },
  { id: 'backlink-researcher', name: 'Backlink Researcher', category: 'SEO', description: 'Identifies link building opportunities, outreach targets, and competitor link profiles.', model: 'your active model', color: '#ff7000', Icon: Link, task: 'Research link building opportunities for my website. Identify high-quality sites to target, analyze competitor backlinks, and draft outreach templates.' },

  // Data & Analytics
  { id: 'data-analyst', name: 'Data Analyst', category: 'Data & Analytics', description: 'Analyzes datasets, identifies trends, builds reports, and answers business questions with data.', model: 'your active model', color: '#06b6d4', Icon: BarChart3, task: 'Analyze data I share with you. Identify trends, surface anomalies, build structured reports, and answer specific business questions with clear data-backed conclusions.' },
  { id: 'bi-consultant', name: 'BI Consultant', category: 'Data & Analytics', description: 'Designs dashboards, KPI frameworks, and data visualization strategies.', model: 'your active model', color: '#06b6d4', Icon: PieChart, task: 'Help me build a business intelligence strategy — design dashboards, define KPIs that matter, and create a data visualization framework that drives decisions.' },
  { id: 'python-data-scientist', name: 'Python Data Scientist', category: 'Data & Analytics', description: 'Writes Python for data analysis, visualization, machine learning, and automation.', model: 'your active model', color: '#06b6d4', Icon: Code, task: 'Write Python code for data analysis, visualization, and machine learning. Use pandas, numpy, matplotlib, scikit-learn, or whatever is appropriate.' },

  // Productivity
  { id: 'executive-assistant', name: 'Executive Assistant', category: 'Productivity', description: 'Manages tasks, drafts communications, schedules planning, and keeps you organized.', model: 'your active model', color: '#8b5cf6', Icon: ClipboardList, task: 'Act as my executive assistant. Help me manage tasks, draft professional communications, plan my schedule, and stay organized and on top of priorities.' },
  { id: 'project-manager', name: 'Project Manager', category: 'Productivity', description: 'Creates project plans, tracks milestones, manages risks, and keeps teams aligned.', model: 'your active model', color: '#8b5cf6', Icon: Calendar, task: 'Help me manage my project. Create a project plan with milestones, identify risks, track progress, and keep all stakeholders aligned and informed.' },
  { id: 'meeting-summarizer', name: 'Meeting Summarizer', category: 'Productivity', description: 'Turns meeting transcripts into action items, decisions, and structured summaries.', model: 'your active model', color: '#8b5cf6', Icon: MessageSquare, task: 'Summarize my meeting transcript into a clean, structured document with: key decisions made, action items with owners and due dates, and a brief executive summary.' },
  { id: 'task-prioritizer', name: 'Task Prioritizer', category: 'Productivity', description: 'Applies frameworks (Eisenhower, MoSCoW, RICE) to help you focus on what matters most.', model: 'your active model', color: '#8b5cf6', Icon: Filter, task: 'Help me prioritize my task list. Apply the Eisenhower matrix, MoSCoW, or RICE framework to help me focus on what will have the highest impact.' },

  // Personal
  { id: 'life-coach', name: 'Life Coach', category: 'Personal', description: 'Goal setting, accountability, mindset coaching, and personal development planning.', model: 'your active model', color: '#f43f5e', Icon: Star, task: 'Be my life coach. Help me set meaningful goals, build accountability systems, work through mindset blocks, and create a personal development plan.' },
  { id: 'career-advisor', name: 'Career Advisor', category: 'Personal', description: 'Resume review, job search strategy, career pivots, and professional development.', model: 'your active model', color: '#f43f5e', Icon: Briefcase, task: 'Advise me on my career. Review my resume, help me develop a job search strategy, think through potential pivots, and plan my professional development.' },
  { id: 'resume-writer', name: 'Resume Writer', category: 'Personal', description: 'Writes and optimizes resumes and LinkedIn profiles for target roles.', model: 'your active model', color: '#f43f5e', Icon: FileText, task: 'Write and optimize my resume for the roles I am targeting. Make it ATS-friendly, highlight my strongest achievements, and ensure it tells a compelling story.' },
  { id: 'travel-planner', name: 'Travel Planner', category: 'Personal', description: 'Creates detailed itineraries, finds deals, and handles all aspects of trip planning.', model: 'your active model', color: '#f43f5e', Icon: Map, task: 'Plan my trip in detail. Create a day-by-day itinerary, recommend accommodation and restaurants, suggest what not to miss, and help me get the best value.' },
  { id: 'personal-shopper', name: 'Personal Shopper', category: 'Personal', description: 'Finds products matching your criteria, compares options, and makes recommendations.', model: 'your active model', color: '#f43f5e', Icon: ShoppingCart, task: 'Help me find the best products for my needs. Understand my criteria, compare options, and make clear recommendations with reasoning.' },
]

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onDeploy,
}: {
  template: AgentTemplate
  onDeploy: () => void
}) {
  const { Icon } = template
  const catColor = CATEGORY_COLORS[template.category] ?? '#7f77dd'

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--border-color)] transition-all duration-200">
      {/* Icon + name row */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: template.color + '22', color: template.color }}
        >
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--text-primary)] leading-tight">{template.name}</div>
          <span
            className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: catColor + '18', color: catColor, border: `1px solid ${catColor}28` }}
          >
            {template.category}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-[var(--text-muted)] leading-relaxed flex-1 line-clamp-2">{template.description}</p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-[var(--text-muted)] font-mono">Best with: {template.model}</span>
        <button
          onClick={onDeploy}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-all active:scale-95"
          style={{ background: template.color }}
        >
          Deploy →
        </button>
      </div>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function AgentTemplatesView() {
  const { spawnAgent, setView } = useAppStore(useShallow(s => ({ spawnAgent: s.spawnAgent, setView: s.setView })))

  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = TEMPLATES
    if (activeCategory !== 'All') list = list.filter(t => t.category === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      )
    }
    return list
  }, [activeCategory, search])

  const handleDeploy = (template: AgentTemplate) => {
    void spawnAgent(template.task, undefined, template.name)
    setView('swarm')
  }

  const categoryCount = useMemo(() => {
    const counts: Record<string, number> = {}
    TEMPLATES.forEach(t => {
      counts[t.category] = (counts[t.category] ?? 0) + 1
    })
    return counts
  }, [])

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Left: Category filter (180px) ─── */}
      <div
        className="flex-shrink-0 flex flex-col min-h-0 overflow-hidden"
        style={{ width: 180, borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
      >
        <div className="px-4 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Categories</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat
            const count = cat === 'All' ? TEMPLATES.length : (categoryCount[cat] ?? 0)
            const color = CATEGORY_COLORS[cat] ?? '#7f77dd'
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={clsx(
                  'w-full flex items-center justify-between px-4 py-2 text-xs font-medium transition-colors text-left',
                  isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-muted)]'
                )}
                style={isActive ? { background: color + '15', borderLeft: `2px solid ${color}` } : { borderLeft: '2px solid transparent' }}
              >
                <span className="truncate">{cat}</span>
                <span
                  className="flex-shrink-0 text-[10px] ml-1 px-1.5 py-0.5 rounded-full"
                  style={{
                    background: isActive ? color + '25' : 'var(--bg-tertiary)',
                    color: isActive ? color : 'var(--text-muted)',
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Right: Template grid ─────────── */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#7f77dd22' }}>
            <LayoutTemplate size={18} style={{ color: '#7f77dd' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-[var(--text-primary)] text-lg">Agent Templates</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              {TEMPLATES.length} templates across {CATEGORIES.length - 1} categories
            </p>
          </div>
          {/* Search */}
          <div className="relative flex-shrink-0" style={{ width: 240 }}>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl pl-8 pr-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 placeholder:text-[var(--text-muted)] transition-colors"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <LayoutTemplate size={32} className="text-[var(--border-color)]" />
              <p className="text-sm text-[var(--text-secondary)]">No templates match your search.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-[var(--text-muted)] mb-4">{filtered.length} template{filtered.length !== 1 ? 's' : ''}</p>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {filtered.map(t => (
                  <TemplateCard key={t.id} template={t} onDeploy={() => handleDeploy(t)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Export featured templates for use in Onboarding
export { TEMPLATES }

