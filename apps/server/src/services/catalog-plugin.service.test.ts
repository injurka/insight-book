import AdmZip from 'adm-zip'
import { expect, it } from 'bun:test'
import { CatalogPluginService } from './catalog-plugin.service'

it('rejects an update archive for another plugin before accessing storage', async () => {
  const zip = new AdmZip()
  zip.addFile('manifest.json', Buffer.from(JSON.stringify({
    id: 'another-plugin',
    name: 'Another plugin',
    version: '2.0.0',
    entryUrl: './remoteEntry.js',
  })))
  const file = new File([new Uint8Array(zip.toBuffer())], 'plugin.zip')
  await expect(new CatalogPluginService().uploadPlugin(1, file, 'selected-plugin'))
    .rejects
    .toThrow('Archive plugin ID does not match the plugin being updated')
})
