import copy
import unittest
from unittest.mock import patch
from cdg import engine
from cdg.games import paths_of_glory as g

class RulesTests(unittest.TestCase):
 def new(self,**options):
  with patch.object(g,'shuffled',lambda ids:list(ids)):
   return engine.create(g.ID,{'guns':False,**options})
 def step(self,s,**action): return engine.apply(s,action)[0]
 def rolled(self,die): return self.step(self.new(),type='roll',value=die)
 def exhaust(self,s,side='cp'):
  p=s['sides'][side];p['discard']+=p['deck'];p['deck']=[];g.clamp(s,side)
 def assign(self,s,side,slot,cid,up=True):
  p=s['sides'][side]
  old=g.card(s,side,slot)['id']
  if cid in p['deck']:
   i=p['deck'].index(cid);p['deck'][i]=old
  else:
   found=next(x for x,c in p['slots'].items() if c and c['id']==cid);p['slots'][found]['id']=old
  if slot=='C':p['deck'][0]=cid;p['c_face_up']=up
  else:p['slots'][slot]={'id':cid,'face_up':up};p['faces'][slot]=up
  g.validate(s)
 def test_setup_dual_deck_four_slots_c_is_top(self):
  s=self.new();p=s['sides']['cp']
  self.assertEqual(len(p['deck']),10)
  self.assertEqual([p['slots'][x]['face_up'] for x in 'ABDE'],[True,True,False,False])
  self.assertEqual(g.card(s,'cp','C')['id'],p['deck'][0])
  self.assertEqual(p['remaining'],7)
 def test_guns_forced_event_without_roll_and_remove(self):
  s=self.new(guns=True);actions=g.available_actions(s)
  self.assertEqual(len(actions),1);self.assertEqual(actions[0]['slot'],'C');self.assertEqual(actions[0]['mode'],'event')
  with self.assertRaises(ValueError):self.step(s,type='roll')
  s=engine.apply(s,actions[0])[0]
  self.assertEqual(s['sides']['cp']['removed'],['cp-01'])
  self.assertEqual(s['sides']['cp']['remaining'],6)
  s=self.step(s,type='resolve');self.assertEqual(s['active'],'ap');self.assertFalse(s['sides']['cp']['c_face_up'])
 def test_eight_card_option_still_six_rounds(self):
  s=self.new(max_hand=8)
  while s['phase']!='draw':
   actions=g.available_actions(s);s=engine.apply(s,actions[0])[0]
  self.assertEqual(s['rounds'],{'cp':6,'ap':6})
  self.assertEqual(s['sides']['cp']['remaining'],2)
  self.assertEqual(s['sides']['ap']['remaining'],2)
 def test_all_fixed_slot_dice_reveal_exact_candidates(self):
  for die,slots in [(3,'ABC'),(4,'AB'),(5,'CDE'),(6,'DE')]:
   with self.subTest(die=die):
    s=self.rolled(die);self.assertEqual({c['slot'] for c in g.candidates(s)},set(slots))
    self.assertTrue(all(g.card(s,'cp',x)['face_up'] for x in slots))
 def test_die_one_c_plus_all_tied_lowest_excludes_high(self):
  s=self.new();self.assign(s,'cp','A','cp-09');self.assign(s,'cp','B','cp-02');self.assign(s,'cp','D','cp-03')
  s=self.step(s,type='roll',value=1)
  self.assertEqual({c['slot'] for c in g.candidates(s)},{'B','C','D'})
 def test_die_one_refill_c_face_up(self):
  s=self.rolled(1);next_id=s['sides']['cp']['deck'][1]
  s=self.step(s,type='play',slot='C',mode='ops',base_legal=True)
  self.assertFalse(s['sides']['cp']['c_face_up'])
  s=self.step(s,type='resolve')
  self.assertEqual(g.card(s,'cp','C'),{'id':next_id,'face_up':True})
 def test_refill_other_slot_consumes_top_c_not_an_extra_card(self):
  s=self.rolled(3);p=s['sides']['cp'];top=p['deck'][0];next_card=p['deck'][1];count=len(p['deck'])
  s=self.step(s,type='play',slot='A',mode='ops',base_legal=True)
  self.assertIsNone(s['sides']['cp']['slots']['A'])
  s=self.step(s,type='resolve');p=s['sides']['cp']
  self.assertEqual(p['slots']['A'],{'id':top,'face_up':True});self.assertEqual(p['deck'][0],next_card)
  self.assertEqual(len(p['deck']),count-1);self.assertFalse(p['c_face_up'])
 def test_die_two_human_reveals_until_two(self):
  s=self.new()
  for slot in 'ABDE':s['sides']['cp']['slots'][slot]['face_up']=False;s['sides']['cp']['faces'][slot]=False
  s=self.step(s,type='roll',value=2);self.assertEqual(s['pending']['status'],'reveal');self.assertEqual(g.candidates(s),[])
  s=self.step(s,type='reveal',slot='D');self.assertEqual(s['pending']['status'],'reveal')
  s=self.step(s,type='reveal',slot='C');self.assertEqual(s['pending']['status'],'select')
  with self.assertRaises(ValueError):self.step(s,type='reveal',slot='A')
 def test_die_two_event_or_lowest_ops_only(self):
  s=self.new();self.assign(s,'cp','A','cp-09');self.assign(s,'cp','B','cp-02')
  s=self.step(s,type='roll',value=2);c={a['slot']:a['modes'] for a in g.candidates(s)}
  self.assertEqual(c['A'],['event']);self.assertEqual(c['B'],['ops'])
  with self.assertRaises(ValueError):self.step(s,type='play',slot='A',mode='ops',base_legal=True)
  with self.assertRaises(ValueError):self.step(s,type='play',slot='B',mode='event',base_legal=True)
 def test_face_down_and_wrong_slot_and_missing_attestation_rejected(self):
  s=self.rolled(4);before=copy.deepcopy(s)
  for a in [{'slot':'D','mode':'ops','base_legal':True},{'slot':'A','mode':'event'},{'slot':'C','mode':'ops','base_legal':True}]:
   with self.assertRaises(ValueError):self.step(s,type='play',**a)
  self.assertEqual(s,before)
 def test_additional_card_effect_does_not_decrement_remaining(self):
  s=self.rolled(4);s=self.step(s,type='play',slot='A',mode='ops',base_legal=True,grants_cards=True)
  self.assertEqual(s['sides']['cp']['remaining'],7)
 def test_exhaustion_clamp_and_automatic_ops_only_without_candidates(self):
  s=self.new();self.exhaust(s);self.assertEqual(s['sides']['cp']['remaining'],4)
  p=s['sides']['cp']
  for slot in 'DE':p['discard'].append(p['slots'][slot]['id']);p['slots'][slot]=None
  s=self.step(s,type='roll',value=6);self.assertIn({'type':'auto_ops'},g.available_actions(s))
  s=self.step(s,type='auto_ops');self.assertEqual(s['sides']['cp']['remaining'],4)
  s=self.step(s,type='resolve');self.assertEqual(s['rounds']['cp'],1)
  s=self.new();self.exhaust(s);s=self.step(s,type='roll',value=4)
  with self.assertRaises(ValueError):self.step(s,type='auto_ops')
 def test_exhaustion_does_not_invent_a_refill(self):
  s=self.new();self.exhaust(s);s=self.step(s,type='roll',value=4)
  s=self.step(s,type='play',slot='A',mode='ops',base_legal=True);s=self.step(s,type='resolve')
  self.assertIsNone(s['sides']['cp']['slots']['A']);self.assertEqual(s['sides']['cp']['remaining'],3)
 def test_zero_remaining_skips_without_die(self):
  s=self.new();s['sides']['cp']['remaining']=0
  self.assertEqual(g.available_actions(s),[{'type':'skip'}]);s=self.step(s,type='skip');self.assertEqual(s['active'],'ap')
 def test_draw_phase_limited_cc_discard_and_reset_face_down(self):
  s=self.new();s['phase']='draw';s['rounds']={'cp':6,'ap':6};s['draw_allowance']={'cp':1,'ap':1};s['sides']['cp']['remaining']=1
  self.assign(s,'cp','A','cp-02');self.assign(s,'cp','B','cp-04')
  s=self.step(s,type='draw_discard',side='cp',slot='A')
  with self.assertRaises(ValueError):self.step(s,type='draw_discard',side='cp',slot='B')
  s=self.step(s,type='next_turn',base_phases_done=True)
  self.assertFalse(g.card(s,'cp','A')['face_up']);self.assertTrue(g.card(s,'cp','B')['face_up'])
  self.assertEqual(s['sides']['cp']['remaining'],7);self.assertEqual(s['turn'],2)
 def test_exhaustion_shuffle_includes_hidden_only(self):
  s=self.new();self.exhaust(s);s['phase']='resolve';s['pending']={'die':4,'status':'select','played':{'automatic_ops':1}}
  before=copy.deepcopy(s['sides']['cp']);s=self.step(s,type='reshuffle',side='cp',reason='exhaustion')
  after=s['sides']['cp'];self.assertEqual(after['slots']['A'],before['slots']['A']);self.assertEqual(after['slots']['B'],before['slots']['B'])
  self.assertFalse(after['slots']['D']['face_up']);self.assertFalse(after['slots']['E']['face_up']);self.assertEqual(after['discard'],[])
 def test_war_shuffle_all_display_adds_next_stage(self):
  s=self.new();s['phase']='draw';s=self.step(s,type='reshuffle',side='cp',reason='war',stage='limited',base_legal=True)
  p=s['sides']['cp'];self.assertEqual(len(p['deck'])+4,34);self.assertEqual(p['stage'],'limited')
  self.assertEqual([p['slots'][x]['face_up'] for x in 'ABDE'],[True,True,False,False]);self.assertFalse(p['c_face_up'])
  with self.assertRaises(ValueError):self.step(s,type='reshuffle',side='cp',reason='war',stage='limited',base_legal=True)
 def test_mata_hari_user_correction_and_ap_espionage(self):
  for side,cid in [('cp','cp-17'),('ap','ap-23')]:
   s=self.new();s['phase']='draw';s=self.step(s,type='reshuffle',side=side,reason='war',stage='limited',base_legal=True)
   s['phase']='action';s['active']=side;self.assign(s,side,'A',cid)
   s=self.step(s,type='roll',value=4);s=self.step(s,type='play',slot='A',mode='event',base_legal=True,destination='removed')
   self.assertTrue(s['pending']['played']['espionage']);self.assertEqual(s['pending']['played']['mode'],'ops')
   self.assertEqual(len(g.visible(s,g.other(side))),5)
  self.assertEqual(g.CARDS['cp-17']['name'],'마타 하리');self.assertEqual(g.CARDS['cp-22']['ops'],3)
 def battle(self):
  s=self.rolled(4);s=self.step(s,type='play',slot='A',mode='ops',base_legal=True)
  self.assign(s,'cp','B','cp-02');self.assign(s,'ap','A','ap-04')
  return self.step(s,type='battle_start',attacker='ap')
 def test_combat_attacker_first_refill_after_defender_no_extra_round(self):
  s=self.battle();self.assertEqual(s['battle']['side'],'ap');remaining=s['sides']['ap']['remaining']
  s=self.step(s,type='combat_play',slot='A',destination='discard',base_legal=True)
  self.assertIsNone(s['sides']['ap']['slots']['A']);self.assertEqual(s['sides']['ap']['remaining'],remaining-1)
  s=self.step(s,type='combat_pass');self.assertEqual(s['battle']['side'],'cp')
  s=self.step(s,type='combat_pass');self.assertTrue(s['sides']['ap']['slots']['A']['face_up']);self.assertIsNone(s['battle']);self.assertEqual(s['rounds']['cp'],0)
 def test_unspecified_combat_retention_is_not_invented(self):
  s=self.battle()
  with self.assertRaises(ValueError):self.step(s,type='combat_play',slot='A',destination='retain',base_legal=True)
 def test_both_sides_empty_end_action_phase(self):
  s=self.new();s['sides']['cp']['remaining']=0;s['sides']['ap']['remaining']=0
  s=self.step(s,type='skip');self.assertEqual(s['phase'],'draw')
 def test_public_state_excludes_hidden_ids_and_deck_order(self):
  s=self.new();v=engine.view(s)
  for side in g.SIDES:
   p=v['sides'][side];self.assertNotIn('deck',p);self.assertNotIn('slots',p)
   for slot in 'CDE':self.assertIsNone(p['display'][slot]['card'])
 def test_conservation_rejects_duplicate_cards(self):
  s=self.new();s['sides']['cp']['deck'].append(s['sides']['cp']['deck'][0])
  with self.assertRaises(ValueError):g.validate(s)
 def test_long_game_reaches_exhaustion_without_deadlock(self):
  s=self.new()
  for turn in range(1,5):
   for _ in range(70):
    if s['phase']=='draw':break
    a=g.available_actions(s)[0];s=engine.apply(s,a)[0]
   self.assertEqual(s['phase'],'draw');self.assertEqual(s['turn'],turn)
   s=self.step(s,type='next_turn',base_phases_done=True)

if __name__=='__main__':unittest.main()
