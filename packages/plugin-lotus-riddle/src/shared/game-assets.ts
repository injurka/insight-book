import pavilion from '../assets/pavilion.png'
import { bounded } from './api'

export { pavilion }
export async function preloadAssets(): Promise<void> {
  const image = new Image()
  image.src = pavilion
  await bounded(image.decode(), 8000)
}
