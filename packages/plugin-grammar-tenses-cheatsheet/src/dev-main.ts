import { createSandboxApp } from '@injurka/insight-book-plugin-api/testing'
import plugin from './index'

const app = createSandboxApp({ plugin })
app.mount('#app')

const fixtureClass = 'grammar-tenses-sandbox-analysis'

function mountAnalysisFixture() {
  const scene = document.querySelector<HTMLElement>('.mock-reader-scene')
  if (!scene || scene.querySelector(`.${fixtureClass}`))
    return

  const fixture = document.createElement('div')
  fixture.className = `analysis-block ${fixtureClass}`
  fixture.innerHTML = `
    <h3>Грамматика</h3>
    <div class="grammar-card">
      <div class="rule-pattern">Simple Past (made)</div>
      <div class="rule-exp">Глагол 'make' в прошедшем времени используется в устойчивом выражении 'make an answer'.</div>
      <div class="rule-ex">Пример: He made no answer.</div>
    </div>
  `
  scene.append(fixture)
}

const fixtureObserver = new MutationObserver(mountAnalysisFixture)

fixtureObserver.observe(document.body, { childList: true, subtree: true })
mountAnalysisFixture()
