import test from "node:test";
import assert from "node:assert/strict";
import {
  supportUnreadUserCount,
  supportUnreadIncomingMessageCount
} from "./index.js";

test("Admin notification counts one unread person, not each message",()=>{
  const messages=[
    ...Array.from({length:10},(_,index)=>({
      conversation_id:"conversation-eric",
      sender_role:"user",
      read_at:null,
      id:"eric-"+index
    })),
    {conversation_id:"conversation-ada",sender_role:"user",read_at:null,id:"ada-1"},
    {conversation_id:"conversation-ada",sender_role:"user",read_at:null,id:"ada-2"},
    {conversation_id:"conversation-read",sender_role:"user",read_at:"2026-11-27T08:00:00Z"}
  ];
  const conversations=[
    {id:"conversation-eric",user_id:"eric-user-id"},
    {id:"conversation-ada",user_id:"ada-user-id"},
    {id:"conversation-read",user_id:"read-user-id"}
  ];
  assert.equal(supportUnreadUserCount(messages,conversations),2);
});

test("Admin notification counts a person once across multiple conversations",()=>{
  const messages=[
    {conversation_id:"conversation-1",sender_role:"user",read_at:null},
    {conversation_id:"conversation-2",sender_role:"user",read_at:null}
  ];
  const conversations=[
    {id:"conversation-1",user_id:"same-user"},
    {id:"conversation-2",user_id:"same-user"}
  ];
  assert.equal(supportUnreadUserCount(messages,conversations),1);
});

test("Admin notification safely falls back to distinct conversations if profile mapping is missing",()=>{
  const messages=[
    {conversation_id:"conversation-1",sender_role:"user",read_at:null},
    {conversation_id:"conversation-1",sender_role:"user",read_at:null},
    {conversation_id:"conversation-2",sender_role:"user",read_at:null}
  ];
  assert.equal(supportUnreadUserCount(messages,[]),2);
});

test("user notification counts each unread AI or Admin reply",()=>{
  const messages=[
    {id:"ai-1",sender_role:"ai",user_read_at:null},
    {id:"admin-1",sender_role:"admin",user_read_at:null},
    {id:"ai-read",sender_role:"ai",user_read_at:"2026-11-27T08:00:00Z"},
    {id:"user-message",sender_role:"user",user_read_at:null}
  ];
  assert.equal(supportUnreadIncomingMessageCount(messages),2);
});
