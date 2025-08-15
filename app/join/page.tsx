import { JoinForm } from "@/components/JoinForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function JoinPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Join Quiz</h1>
          <p className="text-gray-600 dark:text-gray-300">Enter the game ID and your name to join the quiz</p>
        </div>

        {/* Join Game Form */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-center">Join Game</CardTitle>
            <CardDescription className="text-center">Get ready to test your knowledge!</CardDescription>
          </CardHeader>
          <CardContent>
            <JoinForm />
          </CardContent>
        </Card>

        {/* Back to Home Link */}
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-2">Want to create your own quiz?</p>
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
          >
            Create New Quiz
          </a>
        </div>
      </div>
    </div>
  )
}
