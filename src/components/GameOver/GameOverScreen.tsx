import './GameOverScreen.css';
import { Tile } from '../Tile/Tile';
import { useGameStore } from '../../store/gameStore';
import type { GameOverState } from '../../store/gameStore';

function scoreDigits(n: number): string[] {
  const s = Math.min(Math.max(n, 0), 999);
  if (s >= 100) {
    return [String(Math.floor(s / 100)), String(Math.floor((s % 100) / 10)), String(s % 10)];
  }
  return [String(Math.floor(s / 10)), String(s % 10)];
}

interface Props {
  gameOver: GameOverState;
}

export function GameOverScreen({ gameOver }: Props) {
  const {
    myRole, gameId, player1Name, player2Name, myName,
    startLocalGame, resetToLobby,
  } = useGameStore();

  const { winner, reason, player1Score, player2Score } = gameOver;

  // Result headline
  let headline: string;
  if (gameId && myRole) {
    // Online: personalised
    if (winner === null) {
      headline = "It's a tie.";
    } else if (winner === myRole) {
      headline = reason === 'resignation' ? 'Your opponent resigned.' : 'You won.';
    } else {
      headline = reason === 'resignation' ? 'You resigned.' : 'You lost.';
    }
  } else {
    // Local pass-and-play
    const p1 = player1Name || 'Player 1';
    const p2 = player2Name || 'Player 2';
    if (winner === null) headline = "It's a tie!";
    else headline = `${winner === 'player1' ? p1 : p2} wins!`;
  }

  // Sub-line context
  const subline =
    reason === 'consecutive-passes' ? 'Both players passed — no more moves.' :
    reason === 'rack-empty'         ? 'All tiles played.' :
    '';                              // resignation needs no sub-line

  const p1Label = player1Name || (myRole === 'player1' ? myName : '') || 'Player 1';
  const p2Label = player2Name || (myRole === 'player2' ? myName : '') || 'Player 2';

  const p1Digits = scoreDigits(player1Score);
  const p2Digits = scoreDigits(player2Score);

  const p1IsWinner = winner === 'player1';
  const p2IsWinner = winner === 'player2';
  const isTie      = winner === null;

  return (
    <div className="game-over-overlay">
      <div className="game-over-card">
        <h1 className="game-over-headline">{headline}</h1>
        {subline && <p className="game-over-subline">{subline}</p>}

        <div className="game-over-scores">
          <div className={`game-over-score-col${p1IsWinner || isTie ? ' is-winner' : ''}`}>
            <div className="game-over-digits">
              {p1Digits.map((d, i) => <Tile key={i} letter={d} owner="player1" />)}
            </div>
            <span className="game-over-name">{p1Label}</span>
          </div>

          <div className={`game-over-score-col${p2IsWinner || isTie ? ' is-winner' : ''}`}>
            <div className="game-over-digits">
              {p2Digits.map((d, i) => <Tile key={i} letter={d} owner="player2" />)}
            </div>
            <span className="game-over-name">{p2Label}</span>
          </div>
        </div>

        <div className="game-over-actions">
          {!gameId && (
            <button className="btn btn-primary" onClick={startLocalGame}>Play Again</button>
          )}
          <button className="btn btn-secondary" onClick={resetToLobby}>Back to Menu</button>
        </div>
      </div>
    </div>
  );
}
