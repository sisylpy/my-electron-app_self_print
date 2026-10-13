<template>
  <section class="login-story" aria-label="产品能力介绍">
    <header class="story-brand">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48">
          <path d="M13 16.5A10.5 10.5 0 0 1 23.5 6h4A10.5 10.5 0 0 1 38 16.5v5A10.5 10.5 0 0 1 27.5 32H26l-6.5 5v-5.7A10.5 10.5 0 0 1 13 21.5z" />
          <circle cx="21" cy="19" r="2" />
          <circle cx="30" cy="19" r="2" />
          <path d="M28 28.5A8.5 8.5 0 0 0 36.5 37H38l5 4v-4.5a8.5 8.5 0 0 0 3-6.5c0-3.7-2.4-6.9-5.8-8" />
        </svg>
      </span>
      <span>
        <strong>粒子配送</strong>
        <small>配送商桌面端</small>
      </span>
    </header>

    <div class="story-stage">
      <transition name="story-fade" mode="out-in">
        <div v-if="activeIndex === 0" key="wechat" class="scene scene-wechat" aria-hidden="true">
          <span class="ambient-orb orb-left"></span>
          <span class="ambient-orb orb-right"></span>
          <div class="phone-card">
            <i class="phone-speaker"></i>
            <div class="message-row first"><b></b><span><i></i><i></i></span></div>
            <div class="message-row second"><b></b><span><i></i><i></i></span></div>
            <div class="message-row third"><b></b><span><i></i><i></i></span></div>
          </div>
          <div class="flow-track"><i></i><i></i><i></i></div>
          <div class="order-card">
            <div class="order-title"><b>单</b><span><strong>新订单</strong><small>微信消息已归集</small></span></div>
            <div class="order-row"><i></i><b></b><span></span></div>
            <div class="order-row delay"><i></i><b></b><span></span></div>
            <div class="order-check">✓</div>
          </div>
        </div>

        <div v-else-if="activeIndex === 1" key="order" class="scene scene-order" aria-hidden="true">
          <span class="ambient-orb orb-left"></span>
          <span class="ambient-orb orb-bottom"></span>
          <div class="raw-stack">
            <div class="raw-note note-one"><i></i><b></b><span></span><em></em></div>
            <div class="raw-note note-two"><i></i><b></b><span></span><em></em></div>
          </div>
          <div class="convert-arrow"><i></i><span>›</span></div>
          <div class="clean-list">
            <div class="clean-heading"><b></b><span></span></div>
            <div class="clean-row"><i></i><b></b><span></span><em>✓</em></div>
            <div class="clean-row delay-one"><i></i><b></b><span></span><em>✓</em></div>
            <div class="clean-row delay-two"><i></i><b></b><span></span><em>✓</em></div>
          </div>
        </div>

        <div v-else key="delivery" class="scene scene-delivery" aria-hidden="true">
          <span class="ambient-orb orb-left"></span>
          <span class="ambient-orb orb-right"></span>
          <div class="printer">
            <div class="paper"><b></b><i></i><i></i><i></i></div>
            <div class="printer-body"><i></i><span></span></div>
          </div>
          <div class="route-line"><i></i><i></i><i></i></div>
          <div class="delivery-truck">
            <div class="truck-box"><b></b><i></i></div>
            <div class="truck-cab"><i></i></div>
            <span class="wheel wheel-one"></span><span class="wheel wheel-two"></span>
          </div>
          <div class="delivery-done">✓</div>
        </div>
      </transition>
    </div>

    <div class="story-copy" aria-live="polite">
      <span class="story-kicker">{{ activeStory.kicker }}</span>
      <h1>{{ activeStory.title }}</h1>
      <p>{{ activeStory.description }}</p>
    </div>

    <nav class="story-tabs" aria-label="产品能力切换">
      <button
        v-for="(story, index) in stories"
        :key="story.title"
        type="button"
        :class="{ active: activeIndex === index }"
        :aria-label="`查看${story.title}`"
        :aria-current="activeIndex === index ? 'true' : undefined"
        @click="selectStory(index)"
      >
        <span>{{ index + 1 }}</span>{{ story.shortTitle }}
      </button>
    </nav>
  </section>
</template>

<script>
const STORIES = Object.freeze([
  {
    kicker: '微信订单',
    shortTitle: '消息归集',
    title: '微信消息，自动汇成订单',
    description: '客户发来的文字和图片订单集中处理，不再来回切换和手工抄写。',
  },
  {
    kicker: '智能录单',
    shortTitle: '智能录单',
    title: '零散内容，快速变成清单',
    description: '商品、数量和规格自动整理，确认后直接进入当天的录单工作台。',
  },
  {
    kicker: '配送履约',
    shortTitle: '出库打印',
    title: '录单、出库、打印，一套完成',
    description: '从客户订单到配送单打印紧密衔接，让每天的配送工作更稳、更快。',
  },
]);

export default {
  name: 'LoginStoryPanel',
  data() {
    return {
      stories: STORIES,
      activeIndex: 0,
      timer: null,
    };
  },
  computed: {
    activeStory() {
      return this.stories[this.activeIndex];
    },
  },
  mounted() {
    this.startRotation();
  },
  beforeUnmount() {
    this.stopRotation();
  },
  methods: {
    startRotation() {
      if (this.timer || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      this.timer = window.setInterval(() => {
        this.activeIndex = (this.activeIndex + 1) % this.stories.length;
      }, 5200);
    },
    stopRotation() {
      if (!this.timer) return;
      window.clearInterval(this.timer);
      this.timer = null;
    },
    selectStory(index) {
      this.activeIndex = index;
      this.stopRotation();
      this.startRotation();
    },
  },
};
</script>

<style scoped>
.login-story {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(280px, 1fr) auto auto;
  min-width: 0;
  padding: clamp(28px, 4vw, 58px) clamp(34px, 5.4vw, 84px) 38px;
  overflow: hidden;
}

.login-story::before,
.login-story::after {
  position: absolute;
  border: 1px solid rgba(17, 155, 93, .12);
  border-radius: 50%;
  content: '';
  pointer-events: none;
}

.login-story::before { width: 420px; height: 420px; top: -220px; right: -110px; }
.login-story::after { width: 260px; height: 260px; bottom: -150px; left: -75px; }

.story-brand { position: relative; z-index: 3; display: flex; align-items: center; gap: 13px; }
.brand-mark { display: grid; width: 48px; height: 48px; border-radius: 15px; color: #fff; background: linear-gradient(145deg, #18aa68, #087847); box-shadow: 0 12px 28px rgba(13, 127, 76, .22); place-items: center; }
.brand-mark svg { width: 32px; fill: none; stroke: currentColor; stroke-width: 2.8; stroke-linecap: round; stroke-linejoin: round; }
.story-brand strong, .story-brand small { display: block; }
.story-brand strong { font-size: 20px; letter-spacing: .04em; }
.story-brand small { margin-top: 2px; color: #7b8a82; font-size: 12px; letter-spacing: .12em; }

.story-stage { position: relative; display: grid; min-height: 280px; place-items: center; }
.scene { position: relative; width: min(100%, 630px); height: min(42vh, 390px); min-height: 285px; }
.scene::after { position: absolute; right: 2%; bottom: 2%; left: 2%; height: 75px; border-radius: 50%; background: rgba(65, 111, 88, .08); content: ''; filter: blur(12px); }
.ambient-orb { position: absolute; border-radius: 50%; background: rgba(103, 160, 130, .12); animation: orb-breathe 4.8s ease-in-out infinite; }
.orb-left { top: 14%; left: 2%; width: 82px; height: 82px; }
.orb-right { top: 3%; right: 2%; width: 112px; height: 112px; animation-delay: -2.3s; }
.orb-bottom { right: 3%; bottom: 8%; width: 68px; height: 68px; animation-delay: -1.2s; }

.phone-card, .order-card, .clean-list, .printer { position: absolute; z-index: 2; border: 1px solid rgba(53, 92, 72, .08); background: #fff; box-shadow: 0 22px 50px rgba(40, 78, 58, .12); }
.phone-card { top: 14%; bottom: 13%; left: 8%; width: 31%; border-radius: 29px; }
.phone-speaker { position: absolute; top: 15px; left: 50%; width: 53px; height: 5px; border-radius: 99px; background: #d1ded7; transform: translateX(-50%); }
.message-row { position: absolute; left: 14%; display: flex; align-items: flex-start; gap: 10px; animation: message-rise 3.5s ease-in-out infinite; }
.message-row.first { top: 23%; }
.message-row.second { top: 45%; animation-delay: -.9s; }
.message-row.third { top: 67%; animation-delay: -1.8s; }
.message-row > b { width: 24px; height: 24px; border-radius: 8px; background: #18a765; }
.message-row.second > b { background: #74c8af; }
.message-row.third > b { background: #f1ae59; }
.message-row > span { display: grid; gap: 7px; width: 82px; padding: 9px 10px; border-radius: 10px; background: #e8f7ef; }
.message-row.second > span { background: #f3f7f5; }
.message-row.third > span { background: #fff4e5; }
.message-row i { display: block; height: 4px; border-radius: 9px; background: #78ad91; }
.message-row i:last-child { width: 62%; opacity: .62; }

.flow-track { position: absolute; z-index: 4; top: 49%; left: 42%; display: flex; gap: 14px; align-items: center; }
.flow-track::before { position: absolute; right: -12px; left: -12px; height: 2px; background: #bdd0c6; content: ''; }
.flow-track i { position: relative; width: 8px; height: 8px; border-radius: 50%; background: #16a664; animation: flow-pulse 1.5s ease-in-out infinite; }
.flow-track i:nth-child(2) { animation-delay: .18s; }
.flow-track i:nth-child(3) { animation-delay: .36s; }

.order-card { top: 15%; right: 4%; bottom: 12%; width: 40%; padding: 24px; border-radius: 26px; animation: card-settle .7s ease both; }
.order-title { display: flex; align-items: center; gap: 12px; }
.order-title > b { display: grid; width: 48px; height: 48px; border-radius: 14px; color: #fff; background: #18a765; font-size: 20px; place-items: center; }
.order-title strong, .order-title small { display: block; }
.order-title strong { color: #244436; font-size: 18px; }
.order-title small { margin-top: 5px; color: #82948b; font-size: 10px; }
.order-row { display: grid; grid-template-columns: 16px 1fr 34px; gap: 10px; align-items: center; height: 43px; margin-top: 18px; padding: 0 13px; border-radius: 11px; background: #eff8f3; animation: row-reveal .65s .3s ease both; transform-origin: left center; }
.order-row.delay { margin-top: 10px; animation-delay: .52s; }
.order-row i { width: 10px; height: 10px; border-radius: 50%; background: #58bd84; }
.order-row.delay i { background: #efac55; }
.order-row b, .order-row span { height: 6px; border-radius: 9px; background: #5c776a; }
.order-row span { background: #a6bab0; }
.order-check { position: absolute; right: 25px; bottom: 22px; display: grid; width: 35px; height: 35px; border-radius: 50%; color: #fff; background: #18a765; font-weight: 900; place-items: center; animation: success-pop .5s .8s cubic-bezier(.2, 1.7, .4, 1) both; }

.raw-stack { position: absolute; z-index: 3; top: 21%; left: 4%; width: 35%; }
.raw-note { position: relative; height: 100px; padding: 20px 18px 14px 54px; border-radius: 18px; background: #fff; box-shadow: 0 20px 42px rgba(40, 78, 58, .11); animation: note-float 4s ease-in-out infinite; }
.raw-note.note-two { margin: 18px 0 0 24px; background: #fff9ef; animation-delay: -1.7s; }
.raw-note > i { position: absolute; top: 22px; left: 19px; width: 22px; height: 22px; border-radius: 8px; background: #72c5a0; }
.raw-note.note-two > i { background: #f0ae58; }
.raw-note b, .raw-note span, .raw-note em { display: block; height: 6px; border-radius: 9px; background: #507061; }
.raw-note span { width: 70%; margin-top: 12px; background: #aabdb4; }
.raw-note em { width: 88%; margin-top: 15px; background: #d8e3dd; }
.convert-arrow { position: absolute; z-index: 4; top: 47%; left: 42%; width: 62px; height: 28px; }
.convert-arrow i { position: absolute; top: 13px; width: 51px; border-top: 3px dashed #8fb5a1; }
.convert-arrow span { position: absolute; top: -15px; right: 0; color: #16a664; font-size: 48px; font-weight: 300; }
.clean-list { top: 11%; right: 3%; bottom: 8%; width: 43%; padding: 28px 25px; border-radius: 26px; animation: card-settle .7s ease both; }
.clean-heading { display: grid; gap: 10px; margin-bottom: 20px; }
.clean-heading b, .clean-heading span { display: block; width: 65%; height: 8px; border-radius: 9px; background: #294b3b; }
.clean-heading span { width: 41%; height: 6px; background: #a2b7ad; }
.clean-row { display: grid; grid-template-columns: 12px 1fr 38px 20px; gap: 10px; align-items: center; height: 50px; margin-top: 11px; padding: 0 13px; border-radius: 12px; background: #eef8f2; animation: row-reveal .55s .25s ease both; transform-origin: left center; }
.clean-row.delay-one { animation-delay: .48s; }
.clean-row.delay-two { animation-delay: .7s; }
.clean-row i { width: 10px; height: 10px; border-radius: 50%; background: #5bc48a; }
.clean-row b, .clean-row span { height: 6px; border-radius: 9px; background: #547263; }
.clean-row span { background: #9db4a8; }
.clean-row em { display: grid; width: 20px; height: 20px; border-radius: 50%; color: #fff; background: #18a765; font-size: 11px; font-style: normal; place-items: center; }

.printer { z-index: 4; top: 23%; left: 7%; width: 30%; height: 48%; border-radius: 24px; }
.paper { position: absolute; z-index: 1; top: -28%; left: 16%; width: 68%; height: 105%; padding: 20px 17px; border: 2px solid #d4e2db; border-radius: 8px; background: #fff; animation: sheet-print 2.8s ease-in-out infinite; }
.paper b, .paper i { display: block; height: 6px; margin-bottom: 13px; border-radius: 9px; background: #345746; }
.paper i { height: 4px; background: #bdcec5; }
.printer-body { position: absolute; z-index: 2; right: 0; bottom: 0; left: 0; height: 48%; border-radius: 18px 18px 23px 23px; background: #2d5040; }
.printer-body i { position: absolute; top: 20px; right: 22px; width: 8px; height: 8px; border-radius: 50%; background: #6bdaa0; }
.printer-body span { position: absolute; right: 18%; bottom: 15px; left: 18%; height: 9px; border-radius: 9px; background: #193c2c; }
.route-line { position: absolute; z-index: 2; right: 5%; bottom: 21%; left: 34%; height: 90px; border-bottom: 9px solid #d9e6df; border-radius: 0 0 50% 50%; }
.route-line::after { position: absolute; right: 0; bottom: -7px; left: 0; border-bottom: 3px dashed #36b977; border-radius: 50%; content: ''; animation: route-dash 1.4s linear infinite; }
.route-line i { position: absolute; bottom: -14px; width: 20px; height: 20px; border: 6px solid #fff; border-radius: 50%; background: #18a765; box-shadow: 0 5px 14px rgba(25, 90, 57, .16); }
.route-line i:nth-child(1) { left: 8%; }
.route-line i:nth-child(2) { left: 48%; background: #f0ae58; }
.route-line i:nth-child(3) { right: 5%; }
.delivery-truck { position: absolute; z-index: 5; top: 36%; right: 12%; width: 35%; height: 37%; animation: truck-drive 3.8s ease-in-out infinite; }
.truck-box { position: absolute; top: 3%; left: 0; width: 63%; height: 62%; border-radius: 15px 8px 4px 15px; background: #18a765; }
.truck-box b, .truck-box i { position: absolute; left: 18%; width: 48%; height: 8px; border-radius: 9px; background: #dbf6e7; }
.truck-box b { top: 31%; }
.truck-box i { top: 52%; width: 33%; background: #8fe0b4; }
.truck-cab { position: absolute; top: 20%; right: 3%; width: 37%; height: 45%; border-radius: 5px 15px 4px 4px; background: #4bc17f; }
.truck-cab::before { position: absolute; top: 11%; left: 12%; width: 55%; height: 35%; border-radius: 3px 10px 3px 3px; background: #daf5e6; content: ''; }
.wheel { position: absolute; bottom: 20%; width: 32px; height: 32px; border: 9px solid #294b3b; border-radius: 50%; background: #d4e4dc; }
.wheel-one { left: 17%; }
.wheel-two { right: 12%; }
.delivery-done { position: absolute; z-index: 5; right: 3%; bottom: 17%; display: grid; width: 45px; height: 45px; border: 8px solid #fff; border-radius: 50%; color: #fff; background: #18a765; box-shadow: 0 8px 20px rgba(30, 99, 64, .18); font-weight: 900; place-items: center; animation: success-pop .6s 1s cubic-bezier(.2, 1.7, .4, 1) both; }

.story-copy { position: relative; z-index: 3; min-height: 126px; max-width: 660px; }
.story-kicker { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 11px; color: #0b7145; font-size: 13px; font-weight: 800; letter-spacing: .15em; }
.story-kicker::before { width: 22px; height: 3px; border-radius: 99px; background: #119b5d; content: ''; }
.story-copy h1 { margin: 0; color: #183327; font-size: clamp(29px, 3vw, 44px); font-weight: 850; letter-spacing: -.03em; line-height: 1.18; }
.story-copy p { max-width: 590px; margin: 15px 0 0; color: #66766e; font-size: clamp(14px, 1.25vw, 17px); line-height: 1.8; }
.story-tabs { position: relative; z-index: 3; display: flex; gap: 10px; margin-top: 24px; }
.story-tabs button { display: inline-flex; align-items: center; gap: 8px; padding: 8px 13px 8px 9px; border: 1px solid rgba(49, 91, 70, .14); border-radius: 999px; outline: none; color: #718178; background: rgba(255, 255, 255, .55); font-size: 12px; cursor: pointer; transition: border-color .22s ease, color .22s ease, background .22s ease, transform .22s ease; }
.story-tabs button span { display: grid; width: 22px; height: 22px; border-radius: 50%; color: #6d8277; background: #e5eee9; place-items: center; }
.story-tabs button:hover { transform: translateY(-1px); }
.story-tabs button.active { border-color: rgba(17, 155, 93, .3); color: #0d7145; background: #fff; box-shadow: 0 8px 20px rgba(49, 91, 70, .08); }
.story-tabs button.active span { color: #fff; background: #119b5d; }

.story-fade-enter-active, .story-fade-leave-active { transition: opacity .36s ease, transform .36s ease; }
.story-fade-enter-from { opacity: 0; transform: translateX(18px); }
.story-fade-leave-to { opacity: 0; transform: translateX(-14px); }

@keyframes orb-breathe { 0%, 100% { transform: scale(.94); } 50% { transform: scale(1.05); } }
@keyframes flow-pulse { 0%, 100% { opacity: .22; transform: scale(.75); } 45% { opacity: 1; transform: scale(1.15); } }
@keyframes message-rise { 0%, 100% { transform: translateY(2px); } 50% { transform: translateY(-7px); } }
@keyframes note-float { 0%, 100% { transform: translateY(3px) rotate(-1deg); } 50% { transform: translateY(-7px) rotate(1deg); } }
@keyframes card-settle { from { opacity: 0; transform: translateY(16px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes row-reveal { from { opacity: 0; transform: scaleX(.4); } to { opacity: 1; transform: scaleX(1); } }
@keyframes success-pop { from { opacity: 0; transform: scale(.2) rotate(-25deg); } to { opacity: 1; transform: scale(1) rotate(0); } }
@keyframes route-dash { to { stroke-dashoffset: -42; } }
@keyframes sheet-print { 0%, 18% { transform: translateY(-20px); } 55%, 100% { transform: translateY(12px); } }
@keyframes truck-drive { 0%, 100% { transform: translateX(-6px); } 50% { transform: translateX(12px); } }

@media (max-height: 760px) and (min-width: 781px) {
  .login-story { grid-template-rows: auto minmax(220px, 1fr) auto auto; padding-top: 26px; padding-bottom: 24px; }
  .scene { height: 300px; min-height: 235px; }
  .story-copy { min-height: 102px; }
  .story-copy p { margin-top: 8px; line-height: 1.55; }
  .story-tabs { margin-top: 12px; }
}

@media (max-width: 980px) {
  .login-story { padding-right: 34px; padding-left: 34px; }
  .story-tabs button { padding-right: 9px; }
}

@media (max-width: 780px) {
  .login-story { grid-template-columns: minmax(250px, 1fr) minmax(220px, .75fr); grid-template-rows: auto 1fr auto; padding: 24px 28px 18px; }
  .story-brand { grid-column: 1 / -1; }
  .story-stage { grid-column: 1; grid-row: 2 / 4; min-height: 190px; }
  .scene { height: 230px; min-height: 210px; }
  .story-copy { align-self: center; min-height: 0; }
  .story-copy h1 { font-size: 27px; }
  .story-copy p { margin-top: 8px; font-size: 13px; line-height: 1.6; }
  .story-tabs { align-self: end; margin-top: 9px; }
  .story-tabs button { width: 30px; height: 30px; padding: 3px; border-radius: 50%; font-size: 0; justify-content: center; }
  .story-tabs button span { width: 22px; height: 22px; font-size: 11px; }
}

@media (max-width: 560px) {
  .login-story { display: block; padding: 18px 22px; }
  .brand-mark { width: 40px; height: 40px; border-radius: 12px; }
  .story-brand strong { font-size: 17px; }
  .story-stage { position: absolute; inset: 28px 8px auto 28%; min-height: 175px; opacity: .72; }
  .scene { height: 180px; min-height: 170px; }
  .story-copy { width: 68%; margin-top: 34px; }
  .story-kicker { margin-bottom: 6px; font-size: 10px; }
  .story-copy h1 { font-size: 22px; }
  .story-copy p, .story-tabs { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .login-story *, .login-story *::before, .login-story *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
}
</style>
