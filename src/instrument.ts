// Precisa ser o primeiro import do server.ts: o Sentry só instrumenta HTTP e
// Express (spans de rota no tracing) se o Sentry.init rodar antes de esses
// módulos serem carregados. Aqui só entram env (dotenv) e @sentry/node.
import { initObservability } from './config/observability';

initObservability();
