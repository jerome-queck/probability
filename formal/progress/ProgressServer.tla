-------------------------- MODULE ProgressServer --------------------------
EXTENDS Naturals, FiniteSets

CONSTANT Fault
Owners == {"A", "B"}
Requests == 1..2
Commands == [expectedOwner : Owners, expectedRevision : 0..1,
             mutationId : 1..2, value : BOOLEAN]
Empty == [revision |-> 0, mutationId |-> 0, value |-> FALSE]

VARIABLES rows, phase, trusted, command, applied,
          unauthorizedWrite, staleWrite, dishonestReplay
vars == <<rows, phase, trusted, command, applied,
          unauthorizedWrite, staleWrite, dishonestReplay>>

Init ==
  /\ rows \in [Owners -> {Empty,
       [revision |-> 1, mutationId |-> 0, value |-> FALSE]}]
  /\ phase = [r \in Requests |-> "unused"]
  /\ trusted = [r \in Requests |-> "A"]
  /\ command = [r \in Requests |-> CHOOSE c \in Commands : TRUE]
  /\ applied = [o \in Owners |-> [c \in Commands |-> 0]]
  /\ unauthorizedWrite = FALSE
  /\ staleWrite = FALSE
  /\ dishonestReplay = FALSE

Begin(r, o, c) ==
  /\ phase[r] = "unused"
  /\ phase' = [phase EXCEPT ![r] = "parse"]
  /\ trusted' = [trusted EXCEPT ![r] = o]
  /\ command' = [command EXCEPT ![r] = c]
  /\ UNCHANGED <<rows, applied, unauthorizedWrite, staleWrite, dishonestReplay>>

Authorize(r) ==
  /\ phase[r] = "parse"
  /\ phase' = [phase EXCEPT ![r] =
       IF command[r].expectedOwner = trusted[r] \/ Fault = "owner"
       THEN "write" ELSE "done"]
  /\ UNCHANGED <<rows, trusted, command, applied,
                  unauthorizedWrite, staleWrite, dishonestReplay>>

CompareAndWrite(r) ==
  LET o == trusted[r]
      c == command[r]
      matches == rows[o].revision = c.expectedRevision
      writes == matches \/ (Fault = "revision" /\ c.expectedRevision > 0)
  IN
  /\ phase[r] = "write"
  /\ phase' = [phase EXCEPT ![r] = IF writes THEN "done" ELSE "fallback"]
  /\ rows' = IF writes THEN [rows EXCEPT ![o] =
       [revision |-> @.revision + 1, mutationId |-> c.mutationId, value |-> c.value]]
       ELSE rows
  /\ applied' = IF writes THEN [applied EXCEPT ![o][c] = @ + 1] ELSE applied
  /\ unauthorizedWrite' = (unauthorizedWrite \/ (writes /\ c.expectedOwner # o))
  /\ staleWrite' = (staleWrite \/ (writes /\ ~matches))
  /\ UNCHANGED <<trusted, command, dishonestReplay>>

ReadAfterFailedWrite(r) ==
  LET row == rows[trusted[r]]
      c == command[r]
      exact == row.mutationId = c.mutationId /\
               row.revision = c.expectedRevision + 1 /\ row.value = c.value
      acknowledges == exact \/ (Fault = "replay" /\ row.revision > 0)
  IN
  /\ phase[r] = "fallback"
  /\ phase' = [phase EXCEPT ![r] = "done"]
  /\ dishonestReplay' = (dishonestReplay \/ (acknowledges /\ ~exact))
  /\ UNCHANGED <<rows, trusted, command, applied, unauthorizedWrite, staleWrite>>

Next == \E r \in Requests :
          (\E o \in Owners, c \in Commands : Begin(r, o, c))
          \/ Authorize(r) \/ CompareAndWrite(r) \/ ReadAfterFailedWrite(r)

OwnerAuthorized == ~unauthorizedWrite
RevisionChecked == ~staleWrite
RetryAtMostOnce == \A o \in Owners, c \in Commands : applied[o][c] <= 1
ReplayHonest == ~dishonestReplay

Spec == Init /\ [][Next]_vars
=============================================================================
