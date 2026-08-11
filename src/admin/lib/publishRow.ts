/**
 * The single admin-side entry point for publishing a data row.
 *
 * Publishing and being reachable are not the same thing: the server publishes
 * the row, then reports whether its public URL can actually render (an entry
 * needs a *published* entry template for its post type — see
 * `PublishWarningSchema`). Routing every admin publish path through here means
 * that gap is reported once, in one wording, no matter which surface the user
 * triggered the publish from.
 *
 * Warnings are not failures: the row is published either way, so they toast
 * instead of throwing.
 */
import { publishCmsDataRow } from '@core/persistence'
import type { DataRow } from '@core/data/schemas'
import { pushToast } from '@ui/components/Toast'

export async function publishRowAndWarn(rowId: string): Promise<DataRow> {
  const { row, warnings } = await publishCmsDataRow(rowId)
  for (const warning of warnings) {
    pushToast({
      kind: 'warning',
      title: 'Published, but not reachable yet',
      body: warning.message,
    })
  }
  return row
}
