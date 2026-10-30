import { createFileRoute } from '@tanstack/react-router'
import { SplitFlipDisplay } from '~/components/SplitFlipDisplay'

export const Route = createFileRoute('/')({
  // The display is a WebGL scene, so there is nothing to render on the
  // server, and three.js can't be loaded there on every Node version.
  ssr: false,
  component: SplitFlipDisplay,
})
