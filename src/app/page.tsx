import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            ralph-discuss
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Select two AI models and watch them collaborate through iterative
            discussion to find the best solution to your problem.
          </p>
        </header>

        {/* Main Card - Discussion Interface Placeholder */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Start a Discussion</CardTitle>
            <CardDescription>
              Choose your AI models and enter a prompt to begin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              Discussion interface components coming in Step 4...
            </p>
            <div className="flex justify-center">
              <Button disabled>Start Discussion</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
