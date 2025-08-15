import { GameForm } from "@/components/GameForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">QuizUp!</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Create interactive quizzes and play with friends in real-time
          </p>
        </div>

        {/* Game Creation Form */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Create New Quiz</CardTitle>
            <CardDescription className="text-center">
              Set up your quiz question and let others join to play
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GameForm />
          </CardContent>
        </Card>

        {/* Join Game Link */}
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-2">Already have a game ID?</p>
          <a
            href="/join"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
          >
            Join Existing Game
          </a>
        </div>
      </div>
    </div>
  )
}
