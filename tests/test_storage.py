import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from cdg.storage import Store,Conflict

class StorageTests(unittest.TestCase):
 def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.store=Store(self.tmp.name);self.session=self.store.create('paths-of-glory',{'guns':False},'검증')
 def tearDown(self):self.tmp.cleanup()
 def test_every_choice_persists_and_reload_is_identical(self):
  sid=self.session['id'];s=self.store.act(sid,0,{'type':'roll','value':4})
  loaded=Store(self.tmp.name).read(sid)
  self.assertEqual(s,loaded);self.assertEqual(len(loaded['history']),2)
  self.assertEqual(loaded['history'][-1]['state_after'],loaded['state'])
  self.assertEqual(loaded['llm_context']['revision'],1)
  self.assertEqual(loaded['history'][0]['state_after']['pending'],None)
 def test_stale_revision_does_not_overwrite(self):
  sid=self.session['id'];self.store.act(sid,0,{'type':'roll','value':4});before=self.store.path(sid).read_bytes()
  with self.assertRaises(Conflict):self.store.act(sid,0,{'type':'roll','value':6})
  self.assertEqual(self.store.path(sid).read_bytes(),before)
 def test_invalid_action_never_touches_disk(self):
  sid=self.session['id'];before=self.store.path(sid).read_bytes()
  with self.assertRaises(ValueError):self.store.act(sid,0,{'type':'play','slot':'A','mode':'event','base_legal':True})
  self.assertEqual(self.store.path(sid).read_bytes(),before)
 def test_failed_atomic_replace_preserves_previous_file(self):
  sid=self.session['id'];before=self.store.path(sid).read_bytes()
  with patch('cdg.storage.os.replace',side_effect=OSError('disk full')):
   with self.assertRaises(OSError):self.store.act(sid,0,{'type':'roll','value':4})
  self.assertEqual(self.store.path(sid).read_bytes(),before)
  self.assertEqual(len(list(Path(self.tmp.name).iterdir())),1)
 def test_public_export_contains_only_redacted_state(self):
  context=self.store.read(self.session['id'])['llm_context']
  self.assertNotIn('state_after',context['recent_history'][0])
  self.assertIsNone(context['state']['sides']['cp']['display']['C']['card'])
  self.assertNotIn('deck',context['state']['sides']['cp'])
 def test_sessions_are_independent(self):
  second=self.store.create('paths-of-glory',{'max_hand':8})
  self.store.act(self.session['id'],0,{'type':'note','text':'원래 게임의 전투 결과'})
  self.assertEqual(self.store.read(second['id'])['revision'],0)
  self.assertEqual(len(self.store.listing()),2)
 def test_invalid_session_path_rejected(self):
  with self.assertRaises(ValueError):self.store.read('../../server.py')

if __name__=='__main__':unittest.main()
