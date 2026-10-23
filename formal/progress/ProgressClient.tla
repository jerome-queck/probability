-------------------------- MODULE ProgressClient --------------------------
EXTENDS Naturals

CONSTANT Fault
Owners == {"A", "B"}
Slots == {"write", "read"}

VARIABLES owner, generation, loading, refreshPhase, nextOwner,
          revision, maximum, phase, requestOwner, requestGeneration,
          responseOwner, responseRevision, staleCommit, foreignCommit
vars == <<owner, generation, loading, refreshPhase, nextOwner,
          revision, maximum, phase, requestOwner, requestGeneration,
          responseOwner, responseRevision, staleCommit, foreignCommit>>

Init ==
  /\ owner = "A"
  /\ generation = 0
  /\ loading = FALSE
  /\ refreshPhase = "unused"
  /\ nextOwner = "A"
  /\ revision = [o \in Owners |-> 0]
  /\ maximum = [o \in Owners |-> 0]
  /\ phase = [s \in Slots |-> "unused"]
  /\ requestOwner = [s \in Slots |-> "A"]
  /\ requestGeneration = [s \in Slots |-> 0]
  /\ responseOwner = [s \in Slots |-> "A"]
  /\ responseRevision = [s \in Slots |-> 1]
  /\ staleCommit = FALSE
  /\ foreignCommit = FALSE

Start(s) ==
  /\ ~loading
  /\ phase[s] = "unused"
  /\ phase' = [phase EXCEPT ![s] = "http"]
  /\ requestOwner' = [requestOwner EXCEPT ![s] = owner]
  /\ requestGeneration' = [requestGeneration EXCEPT ![s] = generation]
  /\ UNCHANGED <<owner, generation, loading, refreshPhase, nextOwner,
                  revision, maximum, responseOwner, responseRevision,
                  staleCommit, foreignCommit>>

ReceiveHTTP(s, o, r) ==
  /\ phase[s] = "http"
  /\ phase' = [phase EXCEPT ![s] = "json"]
  /\ responseOwner' = [responseOwner EXCEPT ![s] = o]
  /\ responseRevision' = [responseRevision EXCEPT ![s] = r]
  /\ UNCHANGED <<owner, generation, loading, refreshPhase, nextOwner,
                  revision, maximum, requestOwner, requestGeneration,
                  staleCommit, foreignCommit>>

ReceiveJSON(s) ==
  LET current == ~loading /\ owner = requestOwner[s] /\
                 generation = requestGeneration[s]
      active == ~loading /\ owner = requestOwner[s] /\
                (generation = requestGeneration[s] \/ Fault = "generation")
      validOwner == responseOwner[s] = requestOwner[s]
      commits == active /\ (validOwner \/ Fault = "response-owner")
      row == responseRevision[s]
  IN
  /\ phase[s] = "json"
  /\ phase' = [phase EXCEPT ![s] = "done"]
  /\ revision' = IF commits /\ (row >= revision[owner] \/ Fault = "merge")
       THEN [revision EXCEPT ![owner] = row] ELSE revision
  /\ maximum' = IF commits /\ row > maximum[owner]
       THEN [maximum EXCEPT ![owner] = row] ELSE maximum
  /\ staleCommit' = (staleCommit \/ (commits /\ ~current))
  /\ foreignCommit' = (foreignCommit \/ (commits /\ ~validOwner))
  /\ UNCHANGED <<owner, generation, loading, refreshPhase, nextOwner,
                  requestOwner, requestGeneration, responseOwner, responseRevision>>

RefreshStart(o) ==
  /\ refreshPhase = "unused"
  /\ generation' = generation + 1
  /\ loading' = TRUE
  /\ refreshPhase' = "account-http"
  /\ nextOwner' = o
  /\ UNCHANGED <<owner, revision, maximum, phase, requestOwner,
                  requestGeneration, responseOwner, responseRevision,
                  staleCommit, foreignCommit>>

RefreshAwait(from, to) ==
  /\ refreshPhase = from
  /\ refreshPhase' = to
  /\ UNCHANGED <<owner, generation, loading, nextOwner, revision, maximum,
                  phase, requestOwner, requestGeneration, responseOwner,
                  responseRevision, staleCommit, foreignCommit>>

RefreshJSON(r) ==
  /\ refreshPhase = "progress-json"
  /\ refreshPhase' = "done"
  /\ owner' = nextOwner
  /\ loading' = FALSE
  /\ revision' = [revision EXCEPT ![nextOwner] =
       IF r >= @ \/ Fault = "merge" THEN r ELSE @]
  /\ maximum' = [maximum EXCEPT ![nextOwner] =
       IF r >= @ THEN r ELSE @]
  /\ UNCHANGED <<generation, nextOwner, phase, requestOwner, requestGeneration,
                  responseOwner, responseRevision, staleCommit, foreignCommit>>

Next == (\E s \in Slots : Start(s) \/ ReceiveJSON(s) \/
           (\E o \in Owners, r \in 1..2 : ReceiveHTTP(s, o, r)))
        \/ (\E o \in Owners : RefreshStart(o))
        \/ RefreshAwait("account-http", "account-json")
        \/ RefreshAwait("account-json", "progress-http")
        \/ RefreshAwait("progress-http", "progress-json")
        \/ (\E r \in 0..2 : RefreshJSON(r))

GenerationIsolated == ~staleCommit
ResponseOwnerChecked == ~foreignCommit
ConfirmedRevisionMonotone == \A o \in Owners : revision[o] = maximum[o]

Spec == Init /\ [][Next]_vars
=============================================================================
