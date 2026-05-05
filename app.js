/* ==========================================================================
   Промежуточная аттестация — Web & Java
   Логика тестовой игры: выбор предмета → варианта → прохождение → результаты.
   ========================================================================== */

(function () {
  'use strict';

  // --- Конфигурация ---------------------------------------------------------
  const CONFIG = {
    SECONDS_PER_QUESTION: 30,
  };

  const SUBJECTS = [
    {
      id: 'Web',
      title: 'Web',
      label: 'Промежуточная аттестация',
      meta: 'Веб-разработка · 9 вариантов · 360 вопросов',
    },
    {
      id: 'Java',
      title: 'Java',
      label: 'Промежуточная аттестация',
      meta: 'Программирование · 9 вариантов · 360 вопросов',
    },
  ];

  // --- Состояние ------------------------------------------------------------
  const state = {
    subjectId: null,
    variantNum: null,
    questions: [],
    currentIndex: 0,
    selectedLetter: null,
    answered: false,
    answers: [], // { questionIndex, selectedLetter|null, correctLetter, isCorrect, timedOut }
    secondsLeft: CONFIG.SECONDS_PER_QUESTION,
    timerId: null,
  };

  // --- Утилиты --------------------------------------------------------------
  const root = document.getElementById('app');

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (v !== false && v !== null && v !== undefined) {
        node.setAttribute(k, v);
      }
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      if (typeof child === 'string' || typeof child === 'number') {
        node.appendChild(document.createTextNode(String(child)));
      } else {
        node.appendChild(child);
      }
    }
    return node;
  }

  function clearTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function render(node) {
    root.innerHTML = '';
    node.classList.add('screen-enter');
    root.appendChild(node);
    // Прокрутка к верху на смене экрана
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Экран 1: выбор предмета ---------------------------------------------
  function renderHome() {
    clearTimer();

    const card = el('section', { class: 'card' },
      el('div', { class: 'card-badge' }, 'AITU · 2025 / 2026'),
      el('div', { class: 'eyebrow' }, 'Тренажёр'),
      el('h1', { class: 'title' },
        'Промежуточная ',
        el('em', {}, 'аттестация')
      ),
      el('p', { class: 'subtitle' },
        'Выбери предмет, затем вариант. На каждый вопрос — 30 секунд. ' +
        'После ответа сразу видно, верно ли ты ответил, и какой ответ правильный.'
      ),
      el('div', { class: 'choice-grid choice-grid--2' },
        ...SUBJECTS.map((s) => buildSubjectChoice(s))
      ),
    );

    render(card);
  }

  function buildSubjectChoice(s) {
    return el('button',
      { class: 'choice', type: 'button', onclick: () => selectSubject(s.id) },
      el('span', { class: 'choice-label' }, s.label),
      el('span', { class: 'choice-title' }, s.title),
      el('span', { class: 'choice-meta' }, s.meta),
    );
  }

  function selectSubject(id) {
    state.subjectId = id;
    renderVariantSelect();
  }

  // --- Экран 2: выбор варианта ----------------------------------------------
  function renderVariantSelect() {
    clearTimer();

    const subjectData = window.QUIZ_DATA[state.subjectId];
    if (!subjectData) {
      render(el('section', { class: 'card' },
        el('h1', { class: 'title' }, 'Не нашёл данные'),
        el('p', { class: 'subtitle' }, 'Файл data.js не загрузился. Открой консоль (F12), посмотри ошибку.')
      ));
      return;
    }

    const card = el('section', { class: 'card' },
      el('div', { class: 'card-badge' }, state.subjectId.toUpperCase()),
      el('a', {
        class: 'back-link',
        href: '#',
        onclick: (e) => { e.preventDefault(); renderHome(); }
      }, '← Назад к предметам'),
      el('div', { class: 'eyebrow' }, 'Шаг 2 из 2'),
      el('h2', { class: 'title' }, 'Выбери ', el('em', {}, 'вариант')),
      el('p', { class: 'subtitle' },
        `Всего ${subjectData.variants.length} вариантов по 40 вопросов. Порядок и нумерация совпадают с экзаменационным материалом.`
      ),
      el('div', { class: 'variant-grid' },
        ...subjectData.variants.map((v) =>
          el('button',
            { class: 'variant-tile', type: 'button', onclick: () => startQuiz(v.variant) },
            el('span', { class: 'variant-tile-label' }, 'Вариант'),
            el('span', { class: 'variant-tile-num' }, '№' + v.variant),
            el('span', { class: 'variant-tile-label' }, v.questions.length + ' вопросов'),
          )
        )
      )
    );

    render(card);
  }

  // --- Запуск теста ---------------------------------------------------------
  function startQuiz(variantNum) {
    const subjectData = window.QUIZ_DATA[state.subjectId];
    const variant = subjectData.variants.find((v) => v.variant === variantNum);
    if (!variant) return;

    state.variantNum = variantNum;
    state.questions = variant.questions;
    state.currentIndex = 0;
    state.answers = [];
    renderQuestion();
  }

  // --- Экран 3: вопрос ------------------------------------------------------
  function renderQuestion() {
    clearTimer();
    state.selectedLetter = null;
    state.answered = false;
    state.secondsLeft = CONFIG.SECONDS_PER_QUESTION;

    const q = state.questions[state.currentIndex];
    if (!q) {
      renderResults();
      return;
    }

    const total = state.questions.length;
    const num = state.currentIndex + 1;
    const progressPct = (num / total) * 100;

    const optionsBox = el('div', { class: 'options', id: 'options-box' });
    for (const opt of q.options) {
      optionsBox.appendChild(
        el('button', {
          class: 'option',
          type: 'button',
          'data-letter': opt.letter,
          onclick: () => answerSelected(opt.letter),
        },
          el('span', { class: 'option-letter' }, opt.letter),
          el('span', { class: 'option-text' }, opt.text),
        )
      );
    }

    const shell = el('div', { class: 'quiz-shell' },
      el('div', { class: 'quiz-header' },
        el('div', { class: 'quiz-meta' },
          el('strong', {}, state.subjectId),
          el('span', { class: 'quiz-meta-divider' }),
          'Вариант ' + state.variantNum,
          el('span', { class: 'quiz-meta-divider' }),
          'Вопрос ' + num + ' / ' + total,
        ),
        el('div', { class: 'timer', id: 'timer' },
          el('span', { class: 'timer-dot' }),
          el('span', { id: 'timer-text' }, '00:' + pad(state.secondsLeft))
        )
      ),
      el('div', { class: 'progress' },
        el('div', { class: 'progress-bar', style: 'width: ' + progressPct + '%' })
      ),
      el('div', { class: 'question-card' },
        el('div', { class: 'question-number' }, 'Вопрос №' + num),
        el('div', { class: 'question-text' }, q.question),
        optionsBox,
        el('div', { id: 'feedback-slot' }),
        el('div', { class: 'next-row', id: 'next-slot' }),
      ),
    );

    render(shell);
    startTimer();
  }

  // --- Таймер ---------------------------------------------------------------
  function startTimer() {
    updateTimerDisplay();
    state.timerId = setInterval(() => {
      state.secondsLeft -= 1;
      updateTimerDisplay();
      if (state.secondsLeft <= 0) {
        clearTimer();
        if (!state.answered) handleTimeout();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const timer = document.getElementById('timer');
    const text = document.getElementById('timer-text');
    if (!timer || !text) return;
    text.textContent = '00:' + pad(Math.max(0, state.secondsLeft));
    timer.classList.remove('is-warning', 'is-danger');
    if (state.secondsLeft <= 5) timer.classList.add('is-danger');
    else if (state.secondsLeft <= 10) timer.classList.add('is-warning');
  }

  // --- Ответ выбран пользователем ------------------------------------------
  function answerSelected(letter) {
    if (state.answered) return;
    state.answered = true;
    state.selectedLetter = letter;
    clearTimer();

    const q = state.questions[state.currentIndex];
    const isCorrect = letter === q.correct;

    state.answers.push({
      questionIndex: state.currentIndex,
      selectedLetter: letter,
      correctLetter: q.correct,
      isCorrect,
      timedOut: false,
    });

    revealAnswer({ isCorrect, timedOut: false });
  }

  // --- Время истекло --------------------------------------------------------
  function handleTimeout() {
    state.answered = true;
    const q = state.questions[state.currentIndex];

    state.answers.push({
      questionIndex: state.currentIndex,
      selectedLetter: null,
      correctLetter: q.correct,
      isCorrect: false,
      timedOut: true,
    });

    revealAnswer({ isCorrect: false, timedOut: true });
  }

  // --- Показать правильный ответ -------------------------------------------
  function revealAnswer({ isCorrect, timedOut }) {
    const q = state.questions[state.currentIndex];

    // Подсветка опций
    const optionEls = document.querySelectorAll('#options-box .option');
    optionEls.forEach((btn) => {
      btn.disabled = true;
      const letter = btn.getAttribute('data-letter');
      if (letter === q.correct) {
        btn.classList.add('is-correct');
      } else if (letter === state.selectedLetter && !isCorrect) {
        btn.classList.add('is-incorrect');
      } else {
        btn.classList.add('is-dim');
      }
    });

    // Текст фидбэка
    const feedbackSlot = document.getElementById('feedback-slot');
    feedbackSlot.innerHTML = '';
    const correctOption = q.options.find((o) => o.letter === q.correct);
    const correctText = correctOption ? `${q.correct}) ${correctOption.text}` : q.correct;

    let title;
    if (timedOut) title = 'Время вышло';
    else if (isCorrect) title = 'Верно';
    else title = 'Неправильно';

    const fb = el('div',
      { class: 'feedback ' + (isCorrect ? 'feedback--correct' : 'feedback--incorrect') },
      el('div', { class: 'feedback-title' }, title),
      el('div', { class: 'feedback-body' },
        'Правильный ответ: ',
        el('strong', {}, correctText)
      )
    );
    feedbackSlot.appendChild(fb);

    // Кнопка «Дальше»
    const nextSlot = document.getElementById('next-slot');
    nextSlot.innerHTML = '';
    const isLast = state.currentIndex === state.questions.length - 1;
    nextSlot.appendChild(
      el('button',
        { class: 'btn btn-primary', type: 'button', onclick: nextQuestion },
        isLast ? 'Показать результаты →' : 'Следующий вопрос →'
      )
    );
  }

  function nextQuestion() {
    state.currentIndex += 1;
    if (state.currentIndex >= state.questions.length) {
      renderResults();
    } else {
      renderQuestion();
    }
  }

  // --- Экран 4: результаты --------------------------------------------------
  function renderResults() {
    clearTimer();

    const total = state.questions.length;
    const correct = state.answers.filter((a) => a.isCorrect).length;
    const wrong = state.answers.filter((a) => !a.isCorrect && !a.timedOut).length;
    const skipped = state.answers.filter((a) => a.timedOut).length;
    const percent = total === 0 ? 0 : Math.round((correct / total) * 100);

    const grade = computeGrade(percent);

    const ringRadius = 50;
    const circumference = 2 * Math.PI * ringRadius;
    const dashOffset = circumference - (percent / 100) * circumference;

    let reviewVisible = false;
    const reviewListNode = el('div', { class: 'review-list', id: 'review-list', style: 'display: none;' },
      ...buildReviewItems()
    );

    const card = el('section', { class: 'result-card' },
      el('div', { class: 'result-eyebrow' },
        state.subjectId + ' · Вариант ' + state.variantNum + ' · Итог'
      ),
      el('h1', { class: 'result-grade ' + grade.class }, grade.label),
      el('p', { class: 'result-summary' }, grade.message),

      el('div', { class: 'score-ring' },
        buildScoreRing(percent, dashOffset, circumference, grade.class),
        el('div', {},
          el('div', { class: 'stat-label', style: 'margin-bottom: 8px;' }, 'Результат'),
          el('div', {
            style: 'font-family: var(--font-display); font-size: 36px; font-weight: 700; line-height: 1;'
          }, percent + '%'),
          el('div', { style: 'color: var(--text-muted); font-size: 14px; margin-top: 4px;' },
            correct + ' из ' + total + ' правильных'
          )
        )
      ),

      el('div', { class: 'stats' },
        buildStat('Правильно', correct, 'is-correct'),
        buildStat('Неверно', wrong, 'is-incorrect'),
        buildStat('Пропущено', skipped, 'is-skipped'),
      ),

      el('div', { class: 'btn-row' },
        el('button',
          { class: 'btn btn-primary', type: 'button', onclick: () => startQuiz(state.variantNum) },
          '↻ Пройти этот вариант снова'
        ),
        el('button',
          { class: 'btn btn-ghost', type: 'button', onclick: renderVariantSelect },
          'Другой вариант'
        ),
        el('button',
          { class: 'btn btn-ghost', type: 'button', onclick: renderHome },
          'К предметам'
        ),
        el('button', {
          class: 'review-toggle',
          type: 'button',
          id: 'review-toggle',
          onclick: () => {
            reviewVisible = !reviewVisible;
            reviewListNode.style.display = reviewVisible ? '' : 'none';
            document.getElementById('review-toggle').textContent =
              (reviewVisible ? '▾ ' : '▸ ') + 'Разбор всех ответов';
          }
        }, '▸ Разбор всех ответов'),
      ),

      reviewListNode
    );

    render(card);
  }

  function buildScoreRing(percent, dashOffset, circumference, gradeClass) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ring-svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.innerHTML = `
      <circle class="ring-track" cx="60" cy="60" r="50"></circle>
      <circle class="ring-fill ${gradeClass}" cx="60" cy="60" r="50"
        stroke-dasharray="${circumference}"
        stroke-dashoffset="${circumference}"></circle>
    `;
    // Анимируем заполнение
    setTimeout(() => {
      const fill = svg.querySelector('.ring-fill');
      if (fill) fill.style.strokeDashoffset = dashOffset;
    }, 100);
    return svg;
  }

  function buildStat(label, value, klass) {
    return el('div', { class: 'stat' },
      el('div', { class: 'stat-value ' + (klass || '') }, value),
      el('div', { class: 'stat-label' }, label)
    );
  }

  function buildReviewItems() {
    return state.answers.map((a) => {
      const q = state.questions[a.questionIndex];
      const correctOpt = q.options.find((o) => o.letter === a.correctLetter);
      const selectedOpt = a.selectedLetter
        ? q.options.find((o) => o.letter === a.selectedLetter)
        : null;

      let cls = 'review-item ';
      if (a.timedOut) cls += 'is-skipped';
      else if (a.isCorrect) cls += 'is-correct';
      else cls += 'is-incorrect';

      const yourAnswer = a.timedOut
        ? el('span', { class: 'skip' }, '— (время вышло)')
        : el('span',
            { class: a.isCorrect ? 'ok' : 'bad' },
            a.selectedLetter + ') ' + (selectedOpt ? selectedOpt.text : '')
          );

      return el('div', { class: cls },
        el('div', { class: 'review-q' },
          el('span', { class: 'review-num' }, '№' + (a.questionIndex + 1).toString().padStart(2, '0')),
          el('span', { class: 'review-text' }, q.question),
        ),
        el('div', { class: 'review-answers' },
          el('div', {},
            el('strong', {}, 'Твой ответ: '),
            yourAnswer
          ),
          el('div', {},
            el('strong', {}, 'Правильный: '),
            el('span', { class: 'ok' }, a.correctLetter + ') ' + (correctOpt ? correctOpt.text : ''))
          )
        )
      );
    });
  }

  function computeGrade(p) {
    if (p >= 90) return {
      label: 'Отлично',
      class: 'is-excellent',
      message: 'Сильный результат — материал освоен на отлично. Так держать!'
    };
    if (p >= 75) return {
      label: 'Хорошо',
      class: 'is-good',
      message: 'Хороший результат. Несколько мест можно подтянуть — посмотри разбор ответов.'
    };
    if (p >= 50) return {
      label: 'Удовлетворительно',
      class: 'is-ok',
      message: 'Базу знаешь, но ошибок многовато. Открой разбор и пройдись по слабым местам.'
    };
    return {
      label: 'Плохо',
      class: 'is-bad',
      message: 'Маловато правильных. Без паники: разбери все вопросы и пройди вариант ещё раз.'
    };
  }

  // --- Старт ----------------------------------------------------------------
  if (!window.QUIZ_DATA) {
    root.innerHTML = '<section class="card"><h1 class="title">Ошибка</h1><p class="subtitle">Не загрузился data.js — открой index.html через Live Server, локальный сервер или задеплой папку как статический сайт.</p></section>';
  } else {
    renderHome();
  }
})();
