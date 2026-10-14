"use client";

import * as React from "react";
import {
  Gamepad2,
  Sparkles,
  Check,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Clock,
  RotateCcw,
  Flame,
  Trophy,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RequireStudent } from "@/components/student/require-student";
import { TopicPicker } from "@/components/student/topic-picker";
import {
  apiFetch,
  optionText,
  fetchTopicGameData,
  type Game,
  type GameStats,
  type LeaderboardEntry,
  type Question,
  type Topic,
  type MemoryPair,
  type OrderingStep,
} from "@/lib/api";
import { cn } from "cn";

type Tab = "play" | "leaderboard" | "stats";

export function GamesView() {
  const [tab, setTab] = React.useState<Tab>("play");

  return (
    <RequireStudent title="Games">
      <div className="grid gap-5">
        <section>
          <h1 className="font-heading text-2xl font-semibold">Learning games</h1>
          <p className="text-sm text-muted-foreground">
            Play topic games, earn XP and climb the leaderboard.
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          {(["play", "leaderboard", "stats"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                tab === t && "border-primary bg-primary/5 text-primary"
              )}
            >
              {t === "play" ? "Play" : t === "leaderboard" ? "Leaderboard" : "My stats"}
            </button>
          ))}
        </div>

        {tab === "play" ? <PlayPanel /> : null}
        {tab === "leaderboard" ? <LeaderboardPanel /> : null}
        {tab === "stats" ? <StatsPanel /> : null}
      </div>
    </RequireStudent>
  );
}

function PlayPanel() {
  const [games, setGames] = React.useState<Game[]>([]);
  const [game, setGame] = React.useState<Game | null>(null);
  const [topic, setTopic] = React.useState<Topic | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = await apiFetch<{ games: Game[] }>("/games");
        if (active) setGames(d.games);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load games");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (game && topic) {
    return renderActiveGame(game, topic, () => {
      setGame(null);
      setTopic(null);
    });
  }

  if (game) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{game.title}</CardTitle>
          <CardDescription>Pick a topic to play</CardDescription>
        </CardHeader>
        <CardContent>
          <TopicPicker onSelect={setTopic} />
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setGame(null)}>
            Back to games
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        games.map((g) => (
          <Card key={g.id} className="h-full">
            <CardHeader>
              <CardTitle className="text-base">{g.title}</CardTitle>
              <CardDescription>{g.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" className="w-full" onClick={() => setGame(g)}>
                Start game
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

export function TopicGamesRunner({ topic }: { topic: Topic }) {
  const [games, setGames] = React.useState<Game[]>([]);
  const [game, setGame] = React.useState<Game | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Prevent topic crosstalk: when active topic changes, reset running game
  const prevTopicId = React.useRef(topic.id);
  React.useEffect(() => {
    if (prevTopicId.current !== topic.id) {
      setGame(null);
    }
    prevTopicId.current = topic.id;
  }, [topic.id]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = await apiFetch<{ games: Game[] }>("/games");
        if (active) setGames(d.games || []);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load games");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (game) {
    return renderActiveGame(game, topic, () => setGame(null));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Learning Games for {topic.name}</h2>
          <p className="text-xs text-muted-foreground">
            Play interactive games to practice concepts, test speed, and earn XP.
          </p>
        </div>
        {typeof topic._count?.questions === "number" ? (
          <Badge variant="outline" className="text-xs self-start sm:self-auto">
            {topic._count.questions} questions available
          </Badge>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading games…</p>
      ) : games.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No game modes available currently.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => (
            <Card key={g.id} className="flex flex-col justify-between h-full">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-primary" />
                  {g.title}
                </CardTitle>
                <CardDescription className="text-xs">{g.description}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <Button size="sm" className="w-full gap-1.5" onClick={() => setGame(g)}>
                  Play Now
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function renderActiveGame(game: Game, topic: Topic, onExit: () => void) {
  if (game.type === "memory_match" || game.id === "memory-match") {
    return <MemoryMatchRunner game={game} topic={topic} onExit={onExit} />;
  }
  if (game.type === "ordering_challenge" || game.id === "ordering-puzzle") {
    return <OrderingPuzzleRunner game={game} topic={topic} onExit={onExit} />;
  }
  if (game.type === "timed_challenge" || game.id === "timed-blitz") {
    return <TimedChallengeRunner game={game} topic={topic} onExit={onExit} />;
  }
  return <GameRunner game={game} topic={topic} onExit={onExit} />;
}

// ============================================================================
// 1. MEMORY MATCH GAME RUNNER
// ============================================================================
interface MemoryCard {
  uid: string;
  pairId: string;
  type: "term" | "match";
  content: string;
  isFlipped: boolean;
  isMatched: boolean;
}

function MemoryMatchRunner({
  game,
  topic,
  onExit,
}: {
  game: Game;
  topic: Topic;
  onExit: () => void;
}) {
  const [cards, setCards] = React.useState<MemoryCard[]>([]);
  const [flippedIndices, setFlippedIndices] = React.useState<number[]>([]);
  const [moves, setMoves] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<{
    correct: number;
    total: number;
    score: number;
    xp: number;
    totalXp: number;
    moves: number;
  } | null>(null);

  const initGame = React.useCallback(async () => {
    setLoading(true);
    setError("");
    setResult(null);
    setMoves(0);
    setFlippedIndices([]);
    try {
      const data = await fetchTopicGameData(String(topic.id), game.id);
      const rawPairs =
        data.memoryPairs && data.memoryPairs.length >= 2
          ? data.memoryPairs.slice(0, 4)
          : [
              { id: "p1", term: `${topic.name} Definition`, match: "Fundamental academic concept and rules" },
              { id: "p2", term: "Mathematical Proof", match: "Logical derivation from core principles" },
              { id: "p3", term: "Practical Application", match: "Real-world engineering or physical problem solving" },
              { id: "p4", term: "Verification Step", match: "Check boundary values and consistency" },
            ];

      const deck: MemoryCard[] = [];
      rawPairs.forEach((pair) => {
        deck.push({
          uid: `${pair.id}_term`,
          pairId: pair.id,
          type: "term",
          content: pair.term,
          isFlipped: false,
          isMatched: false,
        });
        deck.push({
          uid: `${pair.id}_match`,
          pairId: pair.id,
          type: "match",
          content: pair.match,
          isFlipped: false,
          isMatched: false,
        });
      });

      // Fisher-Yates shuffle
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }

      setCards(deck);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load memory match data");
    } finally {
      setLoading(false);
    }
  }, [topic.id, topic.name, game.id]);

  React.useEffect(() => {
    initGame();
  }, [initGame]);

  const totalPairs = cards.length / 2;
  const matchedPairs = cards.filter((c) => c.isMatched).length / 2;

  const handleCardClick = async (index: number) => {
    if (loading || submitting || result) return;
    if (flippedIndices.length >= 2) return;
    if (cards[index].isMatched || cards[index].isFlipped) return;

    const nextFlipped = [...flippedIndices, index];
    const newCards = cards.map((c, i) => (i === index ? { ...c, isFlipped: true } : c));
    setCards(newCards);
    setFlippedIndices(nextFlipped);

    if (nextFlipped.length === 2) {
      const idxA = nextFlipped[0];
      const idxB = nextFlipped[1];
      const cardA = newCards[idxA];
      const cardB = newCards[idxB];
      const newMoves = moves + 1;
      setMoves(newMoves);

      if (cardA.pairId === cardB.pairId && cardA.type !== cardB.type) {
        // Matched pair
        const updatedCards = newCards.map((c, i) =>
          i === idxA || i === idxB ? { ...c, isMatched: true, isFlipped: true } : c
        );
        setCards(updatedCards);
        setFlippedIndices([]);

        const newMatchedCount = updatedCards.filter((c) => c.isMatched).length / 2;
        if (newMatchedCount === totalPairs && totalPairs > 0) {
          // Completed
          setSubmitting(true);
          try {
            const submitRes = await apiFetch<{
              correct: number;
              total: number;
              score: number;
              xp: number;
              totalXp: number;
              moves: number;
            }>("/games/submit", {
              method: "POST",
              body: {
                gameId: "memory-match",
                topicId: String(topic.id),
                matchesFound: totalPairs,
                totalPairs,
                moves: newMoves,
              },
            });
            setResult(submitRes);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save game score");
          } finally {
            setSubmitting(false);
          }
        }
      } else {
        // Not a match: flip back
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) => (i === idxA || i === idxB ? { ...c, isFlipped: false } : c))
          );
          setFlippedIndices([]);
        }, 850);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Preparing concept memory cards…</p>
      </div>
    );
  }

  if (result) {
    return (
      <Card className="border-primary/30">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
            <Trophy className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Memory Match Complete! 🧠</CardTitle>
          <CardDescription>{topic.name}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 max-w-md mx-auto text-center">
          <div className="flex justify-center items-center gap-3">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              Score: {result.score}%
            </Badge>
            <Badge className="bg-emerald-600 text-sm px-3 py-1">
              +{result.xp} XP
            </Badge>
            <span className="text-xs text-muted-foreground">{result.moves} moves taken</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Great active recall! You paired all key concepts with their corresponding definitions.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={initGame} className="gap-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" />
              Play Again
            </Button>
            <Button size="sm" onClick={onExit} className="text-xs">
              Back to Games
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <span>Concept Memory Match</span>
            <Badge variant="outline" className="text-[10px]">
              Active Recall
            </Badge>
          </h3>
          <p className="text-xs text-muted-foreground">
            Flip cards to match key terms with formulas and principles.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            Pairs: <strong className="text-foreground">{matchedPairs}/{totalPairs}</strong>
          </span>
          <span className="text-muted-foreground">
            Moves: <strong className="text-foreground">{moves}</strong>
          </span>
          <Button variant="ghost" size="sm" onClick={onExit} className="h-8 text-xs">
            Exit
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((card, idx) => (
          <button
            key={card.uid}
            type="button"
            onClick={() => handleCardClick(idx)}
            disabled={card.isMatched || submitting}
            className={cn(
              "min-h-[110px] p-3 rounded-xl border text-center transition-all duration-200 flex flex-col items-center justify-center relative cursor-pointer select-none",
              card.isMatched
                ? "border-emerald-500/80 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium shadow-xs"
                : card.isFlipped
                ? "border-primary bg-card text-foreground shadow-sm scale-102"
                : "border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:border-primary/40"
            )}
          >
            {card.isMatched ? (
              <div className="space-y-1">
                <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-500" />
                <span className="text-xs font-semibold line-clamp-3">{card.content}</span>
              </div>
            ) : card.isFlipped ? (
              <div className="space-y-1.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    card.type === "term" ? "border-primary/40 text-primary" : "border-muted-foreground/40"
                  )}
                >
                  {card.type === "term" ? "Concept" : "Match"}
                </Badge>
                <p className="text-xs font-medium text-foreground line-clamp-3">{card.content}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground/60">
                <HelpCircle className="h-6 w-6" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Tap to Flip</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 2. ORDERING PUZZLE RUNNER
// ============================================================================
function OrderingPuzzleRunner({
  game,
  topic,
  onExit,
}: {
  game: Game;
  topic: Topic;
  onExit: () => void;
}) {
  const [steps, setSteps] = React.useState<OrderingStep[]>([]);
  const [title, setTitle] = React.useState("");
  const [attempts, setAttempts] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    correct: number;
    total: number;
    score: number;
    xp: number;
    totalXp: number;
  } | null>(null);

  const initGame = React.useCallback(async () => {
    setLoading(true);
    setError("");
    setFeedback(null);
    setResult(null);
    setAttempts(1);
    try {
      const data = await fetchTopicGameData(String(topic.id), game.id);
      setTitle(data.orderingPuzzle?.title || `Logical Procedure: ${topic.name}`);
      const rawSteps =
        data.orderingPuzzle?.steps && data.orderingPuzzle.steps.length >= 2
          ? data.orderingPuzzle.steps
          : [
              { id: "s1", text: "Identify given conditions and initial parameters", order: 1 },
              { id: "s2", text: "Apply relevant theorem or fundamental formula", order: 2 },
              { id: "s3", text: "Execute systematic algebraic or procedural steps", order: 3 },
              { id: "s4", text: "Verify boundary constraints and state final result", order: 4 },
            ];

      // Shuffle steps so student arranges them
      const shuffled = [...rawSteps].sort(() => Math.random() - 0.5);
      if (shuffled.every((s, idx) => s.order === idx + 1) && shuffled.length > 2) {
        [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
      }
      setSteps(shuffled);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load puzzle steps");
    } finally {
      setLoading(false);
    }
  }, [topic.id, topic.name, game.id]);

  React.useEffect(() => {
    initGame();
  }, [initGame]);

  const moveStep = (index: number, direction: "up" | "down") => {
    if (result || submitting) return;
    setFeedback(null);
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    const next = [...steps];
    [next[index], next[targetIdx]] = [next[targetIdx], next[index]];
    setSteps(next);
  };

  const verifySequence = async () => {
    if (submitting || result) return;
    const isCorrect = steps.every((s, idx) => s.order === idx + 1);
    if (isCorrect) {
      setSubmitting(true);
      setError("");
      try {
        const d = await apiFetch<{
          correct: number;
          total: number;
          score: number;
          xp: number;
          totalXp: number;
        }>("/games/submit", {
          method: "POST",
          body: {
            gameId: "ordering-puzzle",
            topicId: String(topic.id),
            isCorrect: true,
            attempts,
          },
        });
        setResult(d);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit puzzle score");
      } finally {
        setSubmitting(false);
      }
    } else {
      const correctPositions = steps.filter((s, idx) => s.order === idx + 1).length;
      setFeedback(
        `${correctPositions} of ${steps.length} steps are in the correct place. Review the procedure and try again!`
      );
      setAttempts((a) => a + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading logical sequence steps…</p>
      </div>
    );
  }

  if (result) {
    return (
      <Card className="border-primary/30">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
            <Trophy className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Procedure Sequenced Correctly! 🧩</CardTitle>
          <CardDescription>{topic.name}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 max-w-md mx-auto text-center">
          <div className="flex justify-center items-center gap-3">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              Score: 100%
            </Badge>
            <Badge className="bg-emerald-600 text-sm px-3 py-1">
              +{result.xp} XP
            </Badge>
            <span className="text-xs text-muted-foreground">Solved in {attempts} attempt(s)</span>
          </div>
          <p className="text-xs text-muted-foreground">
            You mastered the logical derivation and procedural order for this topic.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={initGame} className="gap-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" />
              Play Again
            </Button>
            <Button size="sm" onClick={onExit} className="text-xs">
              Back to Games
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">
            Arrange the derivation steps or problem-solving procedure in the correct chronological order.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline">Attempt #{attempts}</Badge>
          <Button variant="ghost" size="sm" onClick={onExit} className="h-8 text-xs">
            Exit
          </Button>
        </div>
      </div>

      {feedback ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="space-y-2.5">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="flex items-center justify-between gap-3 p-3.5 rounded-lg border bg-card transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                {idx + 1}
              </div>
              <p className="text-xs sm:text-sm font-medium text-foreground">{step.text}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => moveStep(idx, "up")}
                disabled={idx === 0 || submitting}
                title="Move step up"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => moveStep(idx, "down")}
                disabled={idx === steps.length - 1 || submitting}
                title="Move step down"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 flex justify-end">
        <Button onClick={verifySequence} disabled={submitting} className="gap-1.5 text-xs">
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              Verify Step Sequence
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// 3. TIMED QUESTION CHALLENGE (SPEED RUSH)
// ============================================================================
function TimedChallengeRunner({
  game,
  topic,
  onExit,
}: {
  game: Game;
  topic: Topic;
  onExit: () => void;
}) {
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Array<{ questionId: string; selected: number }>>([]);
  const [selectedOption, setSelectedOption] = React.useState<number | null>(null);
  const [timeLeft, setTimeLeft] = React.useState(15);
  const [streak, setStreak] = React.useState(0);
  const [maxStreak, setMaxStreak] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<{
    correct: number;
    total: number;
    score: number;
    xp: number;
    totalXp: number;
  } | null>(null);

  const initGame = React.useCallback(async () => {
    setLoading(true);
    setError("");
    setResult(null);
    setIndex(0);
    setAnswers([]);
    setSelectedOption(null);
    setTimeLeft(15);
    setStreak(0);
    setMaxStreak(0);
    try {
      const d = await apiFetch<{ questions: Question[] }>(
        `/student/questions?topicId=${topic.id}&limit=${game.limit || 5}`
      );
      setQuestions(d.questions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [topic.id, game.limit]);

  React.useEffect(() => {
    initGame();
  }, [initGame]);

  const total = questions.length;
  const currentQ = questions[index];

  const finalizeGame = React.useCallback(
    async (completedAnswers: Array<{ questionId: string; selected: number }>, peakStreak: number) => {
      setSubmitting(true);
      setError("");
      try {
        const streakBonus = Math.min(peakStreak * 5, 25);
        const d = await apiFetch<{
          correct: number;
          total: number;
          score: number;
          xp: number;
          totalXp: number;
        }>("/games/submit", {
          method: "POST",
          body: {
            gameId: "timed-blitz",
            topicId: String(topic.id),
            answers: completedAnswers,
            streakBonus,
          },
        });
        setResult(d);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit game score");
      } finally {
        setSubmitting(false);
      }
    },
    [topic.id]
  );

  React.useEffect(() => {
    if (loading || submitting || result || total === 0 || selectedOption !== null) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          const qId = currentQ?.id;
          const nextAnswers = [...answers, { questionId: String(qId), selected: -1 }];
          setAnswers(nextAnswers);
          setStreak(0);

          if (index + 1 < total) {
            setIndex((i) => i + 1);
            setSelectedOption(null);
            return 15;
          } else {
            finalizeGame(nextAnswers, maxStreak);
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, submitting, result, total, selectedOption, index, currentQ, answers, maxStreak, finalizeGame]);

  const handleSelect = (optionIdx: number) => {
    if (selectedOption !== null || submitting || result || !currentQ) return;
    setSelectedOption(optionIdx);
    const newStreak = streak + 1;
    setStreak(newStreak);
    const newMaxStreak = Math.max(maxStreak, newStreak);
    setMaxStreak(newMaxStreak);

    const nextAnswers = [...answers, { questionId: String(currentQ.id), selected: optionIdx }];
    setAnswers(nextAnswers);

    setTimeout(() => {
      if (index + 1 < total) {
        setIndex((i) => i + 1);
        setSelectedOption(null);
        setTimeLeft(15);
      } else {
        finalizeGame(nextAnswers, newMaxStreak);
      }
    }, 450);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading speed challenge questions…</p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="grid gap-3 text-center p-6">
        <p className="text-sm text-muted-foreground">No questions found for this topic yet.</p>
        <Button variant="outline" size="sm" onClick={onExit} className="mx-auto text-xs">
          Back to Games
        </Button>
      </div>
    );
  }

  if (result) {
    return (
      <Card className="border-primary/30">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
            <Trophy className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Speed Rush Complete! ⚡</CardTitle>
          <CardDescription>{topic.name}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 max-w-md mx-auto text-center">
          <div className="flex justify-center items-center gap-3">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              Score: {result.score}%
            </Badge>
            <Badge className="bg-emerald-600 text-sm px-3 py-1">
              +{result.xp} XP
            </Badge>
            {maxStreak > 1 ? (
              <Badge variant="outline" className="text-amber-600 border-amber-500/40 text-xs px-2">
                🔥 {maxStreak}x Streak
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {result.correct} of {result.total} answered correctly.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={initGame} className="gap-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" />
              Try Again
            </Button>
            <Button size="sm" onClick={onExit} className="text-xs">
              Back to Games
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const timerPercent = (timeLeft / 15) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Q {index + 1} of {total}
          </Badge>
          {streak > 1 ? (
            <Badge className="bg-amber-600 text-[10px] gap-1 px-1.5">
              <Flame className="h-3 w-3 fill-current" />
              {streak}x Streak
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Clock className={cn("h-4 w-4", timeLeft <= 5 ? "text-destructive animate-pulse" : "text-primary")} />
          <span className={timeLeft <= 5 ? "text-destructive" : "text-foreground"}>{timeLeft}s</span>
        </div>
      </div>

      {/* Countdown timer bar */}
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-1000",
            timeLeft <= 5 ? "bg-destructive" : timeLeft <= 8 ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${timerPercent}%` }}
        />
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">{currentQ?.text}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {currentQ
            ? [0, 1, 2, 3].map((oi) => {
                const isSelected = selectedOption === oi;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => handleSelect(oi)}
                    disabled={selectedOption !== null}
                    className={cn(
                      "w-full rounded-lg border px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "border-border bg-card text-foreground hover:bg-muted/70 hover:border-primary/40"
                    )}
                  >
                    {optionText(currentQ, oi)}
                  </button>
                );
              })
            : null}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 4. CLASSIC QUIZ RUNNER (FOR LEGACY GAME MODES)
// ============================================================================
function GameRunner({
  game,
  topic,
  onExit,
}: {
  game: Game;
  topic: Topic;
  onExit: () => void;
}) {
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<{
    correct: number;
    total: number;
    score: number;
    xp: number;
    totalXp: number;
  } | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = await apiFetch<{ questions: Question[] }>(
          `/student/questions?topicId=${topic.id}&limit=${game.limit || 10}`
        );
        if (active) setQuestions(d.questions || []);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load questions");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [topic.id, game.limit]);

  const total = questions.length;
  const question = questions[index];
  const answered = Object.keys(answers).length;

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const payload = questions.map((q) => ({
        questionId: q.id,
        selected: answers[String(q.id)] ?? -1,
      }));
      const d = await apiFetch<{
        correct: number;
        total: number;
        score: number;
        xp: number;
        totalXp: number;
      }>("/games/submit", {
        method: "POST",
        body: { gameId: game.id, topicId: topic.id, answers: payload },
      });
      setResult(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading questions…</p>;
  if (total === 0) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">No questions available for this topic yet.</p>
        <Button variant="outline" size="sm" onClick={onExit}>
          Back to games
        </Button>
      </div>
    );
  }

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{game.title} complete</CardTitle>
          <CardDescription>{topic.name}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={result.score >= 60 ? "secondary" : "destructive"}>
              Score {result.score}%
            </Badge>
            <Badge variant="outline">+{result.xp} XP</Badge>
            <span className="text-sm text-muted-foreground">
              {result.correct}/{result.total} correct · total {result.totalXp} XP
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onExit}>
              Play another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          Question {index + 1} of {total}
        </span>
        <span className="text-muted-foreground">
          {answered}/{total} answered
        </span>
      </div>
      <Progress value={Math.round((answered / total) * 100)} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{question?.text}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {question
            ? [0, 1, 2, 3].map((oi) => {
                const selected = answers[String(question.id)] === oi;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() =>
                      setAnswers((p) => ({ ...p, [String(question.id)]: oi }))
                    }
                    className={
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors " +
                      (selected ? "border-primary bg-primary/5" : "hover:bg-muted")
                    }
                  >
                    {optionText(question, oi)}
                  </button>
                );
              })
            : null}
        </CardContent>
      </Card>

      {error ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setError("")}
            className="h-7 px-2 text-xs hover:bg-destructive/20"
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          Previous
        </Button>
        <div className="flex gap-2">
          {index < total - 1 ? (
            <Button
              variant="outline"
              onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            >
              Next
            </Button>
          ) : null}
          <Button onClick={() => void submit()} disabled={submitting || answered < total}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </div>
      {answered < total ? (
        <p className="text-center text-xs text-muted-foreground">
          Answer all questions to submit.
        </p>
      ) : null}
    </div>
  );
}

function LeaderboardPanel() {
  const [rows, setRows] = React.useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = await apiFetch<{ leaderboard: LeaderboardEntry[] }>("/games/leaderboard");
        if (active) setRows(d.leaderboard);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load leaderboard");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <CardDescription>Top students by XP</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scores yet. Play a game to get on the board!</p>
        ) : (
          rows.map((r, i) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <span className="text-sm font-medium">#{i + 1} · {r.name}</span>
              <Badge variant="secondary">{r.xp} XP</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function StatsPanel() {
  const [stats, setStats] = React.useState<GameStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = await apiFetch<GameStats>("/games/me");
        if (active) setStats(d);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My game stats</CardTitle>
        <CardDescription>
          {stats ? `${stats.totalXp} XP · ${stats.gamesPlayed} games · best ${stats.bestScore}%` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : stats && stats.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No games played yet.</p>
        ) : (
          stats?.recent.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{r.gameId}</p>
                <p className="text-xs text-muted-foreground">
                  {r.topic?.name ?? ""} · {r.correct}/{r.total} correct
                </p>
              </div>
              <Badge variant="outline">+{r.xp} XP</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
