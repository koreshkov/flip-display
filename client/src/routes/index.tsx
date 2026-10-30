import { createFileRoute } from '@tanstack/react-router'
import { SplitFlipDisplay } from '~/components/SplitFlipDisplay'

export const Route = createFileRoute('/')({
  component: SplitFlipDisplay,
})
