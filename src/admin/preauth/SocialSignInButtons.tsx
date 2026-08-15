/**
 * Social sign-in buttons for the pre-auth screen.
 *
 * Text-only on purpose: `pixel-art-icons` carries no Google/GitHub brand mark,
 * inline SVG strings are gated, and a generic glyph next to "Google" would be
 * worse than none. Clicking is a HARD navigation — the whole flow is redirects
 * (provider consent → server callback → back into `/admin` with a session), so
 * there is nothing for client-side routing to do.
 *
 * Renders nothing when no provider is configured; the server only advertises
 * providers whose credentials exist, so this can never offer a dead button.
 */
import { Button } from '@ui/components/Button'
import type { CmsPublicSite } from '@core/persistence/auth'
import styles from './SocialSignInButtons.module.css'

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Continue with Google',
  github: 'Continue with GitHub',
}

export function SocialSignInButtons({
  publicSite,
  disabled,
}: {
  publicSite: CmsPublicSite
  disabled: boolean
}) {
  const providers = publicSite.auth?.socialProviders ?? []
  if (providers.length === 0) return null

  return (
    <div className={styles.socialBlock}>
      <div className={styles.divider} role="presentation">
        <span>or</span>
      </div>
      {providers.map((provider) => (
        <Button
          key={provider}
          variant="secondary"
          size="md"
          fullWidth
          type="button"
          disabled={disabled}
          data-testid={`social-${provider}`}
          onClick={() => {
            window.location.assign(`/admin/api/cms/auth/oauth/${provider}/start`)
          }}
        >
          {PROVIDER_LABELS[provider] ?? `Continue with ${provider}`}
        </Button>
      ))}
    </div>
  )
}
