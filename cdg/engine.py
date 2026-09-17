"""Game-independent dispatcher. New rules belong in adapters, never HTTP/UI code."""
import copy
from .games import GAMES

def create(game, options):
 if game not in GAMES: raise ValueError('지원하지 않는 게임입니다.')
 state=GAMES[game].create(options);GAMES[game].validate(state);return state

def apply(state, action):
 game=GAMES[state['game']];updated=copy.deepcopy(state)
 message=game.apply(updated,action);game.validate(updated)
 return updated,message

def view(state): return GAMES[state['game']].public_view(state)
