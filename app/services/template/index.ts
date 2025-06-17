// Legacy exports (maintained for backward compatibility)
export { TemplateRenderer, getTemplateRenderer } from './TemplateRenderer';
export { 
  TemplateAwareEmail, 
  renderTemplateAwareEmail, 
  renderTemplateForWorkflow 
} from './TemplateAwareEmail';
export { 
  WorkflowTemplateIntegration,
  getWorkflowTemplateIntegration,
  renderTemplateForStep,
  renderEmailTemplate,
  renderInAppTemplate,
  renderSmsTemplate
} from './WorkflowTemplateIntegration';

// New modular exports
export { TemplateEngine, type TemplateContext, type RenderOptions, type RenderResult } from './core/TemplateEngine';
export { LiquidTemplateEngine } from './core/LiquidTemplateEngine';

export { 
  type TemplateLoader, 
  type Template, 
  type TemplateLoadResult,
  TemplateNotFoundError,
  TemplateLoadError 
} from './loaders/TemplateLoader';
export { SupabaseTemplateLoader } from './loaders/SupabaseTemplateLoader';

export { BaseChannelRenderer, type ChannelRenderOptions, type ChannelRenderResult } from './renderers/BaseChannelRenderer';
export { EmailTemplateRenderer, type EmailRenderOptions, type EmailRenderResult } from './renderers/EmailTemplateRenderer';
export { InAppTemplateRenderer } from './renderers/InAppTemplateRenderer';
export { SmsTemplateRenderer } from './renderers/SmsTemplateRenderer';