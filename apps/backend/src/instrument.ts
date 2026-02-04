import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'https://8fb813926bef37f769bf658d2615196a@o4510827006197760.ingest.de.sentry.io/4510827029266512',
  sendDefaultPii: true,
  environment: process.env.NODE_ENV || 'development',
});

export { Sentry };
