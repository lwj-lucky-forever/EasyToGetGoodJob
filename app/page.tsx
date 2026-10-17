import { ArrowDown, ArrowRight, ArrowUpRight, BookOpenText, BriefcaseBusiness, CalendarDays, Check, Layers3, Route, ShieldCheck, Sparkles, Target, TrendingUp, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WORKSPACE_PATHS } from "@/lib/workspace-routes";
import "./portal.css";
import { SiteNavigation } from "@/components/site-navigation";
import { OfferEnvelope } from "@/components/offer-envelope";
import { PortalSkyElements } from "@/components/portal-sky-elements";

const modules = [
  { title: "岗位管理", href: WORKSPACE_PATHS.岗位管理, icon: BriefcaseBusiness, theme: "blue", number: "01", eyebrow: "JOB COLLECTION", description: "整理目标岗位，查看匹配度。", tags: ["网页 / 文本导入", "简历匹配", "准备清单"], detail: "让每一个值得争取的机会，都有清晰的位置。" },
  { title: "求职进度", href: WORKSPACE_PATHS.求职进度, icon: TrendingUp, theme: "mint", number: "02", eyebrow: "APPLICATION PIPELINE", description: "跟踪从待投递到 Offer 的完整求职流程。", tags: ["阶段看板", "状态追踪", "过程记录"], detail: "从准备到收获，看见自己的每一步进展。" },
  { title: "日程安排", href: WORKSPACE_PATHS.日程, icon: CalendarDays, theme: "gold", number: "03", eyebrow: "YOUR NEXT MOVE", description: "管理笔试、面试、提醒等关键时间节点。", tags: ["投递截止", "面试安排", "关键提醒"], detail: "把重要的时间留给准备，让下一步更从容。" },
  { title: "面试题库", href: WORKSPACE_PATHS.面试题库, icon: BookOpenText, theme: "violet", number: "04", eyebrow: "INTERVIEW STUDIO", description: "沉淀高频题目、面试复盘和准备内容。", tags: ["精选题目", "回答练习", "面试复盘"], detail: "让每一次思考与复盘，成为下一次的底气。" },
] as const;

export default function PortalPage() {
  return <main className="portal-page">
    <a href="#portal-modules" className="portal-skip">跳到模块入口</a>
    <header className="portal-header">
      <div className="portal-shell portal-header-inner flex items-center justify-between gap-4">
        <a href="/" aria-label="EasyToGetGoodJob 首页" className="portal-brand">
          <img src="/offer-tower-illustrated-192.png" width={40} height={40} alt="" className="portal-brand-logo" />
          <span><span className="block text-base font-bold tracking-tight sm:text-lg">EasyToGetGoodJob</span><span className="mt-0.5 hidden text-[11px] tracking-wide text-indigo-100/80 sm:block">岗位整理 · 简历适配 · 流程准备</span></span>
        </a>
        <SiteNavigation />
        <button type="button" className="portal-account" aria-label="登录（即将开放）" title="登录（即将开放）" disabled>
          <UserRound aria-hidden="true" size={20} strokeWidth={1.8} />
        </button>
      </div>
    </header>

    <section className="portal-hero" aria-labelledby="portal-title">
      <div className="portal-hero-art" aria-hidden="true" />
      <div className="portal-hero-light" aria-hidden="true" />
      <PortalSkyElements />
      <div className="portal-orbit portal-orbit-one" aria-hidden="true" />
      <div className="portal-orbit portal-orbit-two" aria-hidden="true" />
      <div className="portal-shell relative z-10">
        <div className="portal-hero-copy portal-reveal">
          <span className="portal-eyebrow"><span className="portal-status-dot" />EASY TO GET GOOD JOB<Sparkles className="size-3.5 text-amber-500" /></span>
          <h1 id="portal-title">求职有章法，<br /><span className="portal-title-highlight">好工作更容易<span aria-hidden="true">✦</span></span></h1>
          <div className="portal-offer-friend" aria-hidden="true">
            <OfferEnvelope id="title-offer" />
          </div>
          <p className="portal-hero-description">岗位管理、求职进度、日程安排、面试题库，<br className="hidden sm:block" />一站式管理你的求职全流程。</p>
          <div className="portal-hero-actions">
            <Button asChild className="portal-primary-button"><a href={WORKSPACE_PATHS.岗位管理}>开始管理我的求职<ArrowRight className="size-4" /></a></Button>
            <Button asChild variant="outline" className="portal-secondary-button"><a href="#portal-modules">探索功能<ArrowDown className="size-4" /></a></Button>
          </div>
          <div className="portal-hero-benefits">
            <span><Layers3 />整理更有序</span><span><Route />进度更清晰</span><span><Target />准备更有方向</span>
          </div>
        </div>
      </div>
      <div className="portal-image-caption" aria-hidden="true"><span className="portal-caption-spark">✦</span><span>YOUR NEXT CHAPTER<br /><strong>下一站，好工作。</strong></span></div>
      <div className="portal-hero-bottom" aria-hidden="true" />
    </section>

    <section id="portal-modules" className="portal-modules portal-shell" aria-labelledby="portal-modules-title">
      <div className="portal-section-heading portal-reveal">
        <div><p className="portal-section-eyebrow">ONE WORKSPACE. EVERY NEXT STEP.</p><h2 id="portal-modules-title">四个入口，一条清晰的求职路径<span>。</span></h2></div>
        <p>从收藏机会，到认真准备，<br className="hidden lg:block" />把每一步，都放在心上。</p>
      </div>
      <div className="portal-module-grid">
        {modules.map(({ title, href, icon: Icon, theme, number, eyebrow, description, tags, detail }, index) => <a key={href} href={href} className={`portal-module-card portal-module-${theme} portal-reveal portal-delay-${index}`} aria-label={`进入${title}：${description}`}>
          <div className="portal-module-glow" aria-hidden="true" />
          <div className="portal-module-card-top"><span className="portal-module-icon"><Icon strokeWidth={1.7} /></span><span className="portal-module-number">{number}</span><ArrowUpRight className="portal-module-arrow" /></div>
          <p className="portal-module-eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
          <p className="portal-module-description">{description}</p>
          <div className="portal-module-tags">{tags.map(tag => <span key={tag}><Check className="size-3" />{tag}</span>)}</div>
          <p className="portal-module-detail">{detail}</p>
          <span className="portal-module-enter"><span>进入{title}</span><span className="portal-module-enter-icon"><ArrowRight className="size-4" /></span></span>
        </a>)}
      </div>
    </section>

    <footer className="portal-shell portal-footer"><a href="/" className="font-semibold text-slate-600">EasyToGetGoodJob<span className="ml-2 font-normal text-slate-400">向理想 Offer 出发</span></a><span><ShieldCheck className="size-3.5" />个人工作区数据仅所有者可见</span></footer>
  </main>;
}
