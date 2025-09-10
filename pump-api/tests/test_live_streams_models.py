"""
Unit tests for live streams models and validation.

Tests LiveStream, LiveBet, and SeedAlias model validation,
constraint testing for database fields, and relationship integrity.
"""

import pytest
from datetime import datetime, timezone
from uuid import uuid4, UUID
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.exc import IntegrityError

from app.models.live_streams import LiveStream, LiveBet, SeedAlias


@pytest.fixture
def test_engine():
    """Create an in-memory SQLite engine for testing."""
    engine = create_engine(
        "sqlite:///:memory:", 
        echo=False,
        connect_args={"check_same_thread": False}
    )
    
    # Enable foreign key constraints for SQLite
    from sqlalchemy import event
    
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
    
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def test_session(test_engine):
    """Create a test database session."""
    with Session(test_engine) as session:
        yield session


class TestLiveStreamModel:
    """Test LiveStream model validation and constraints."""

    def test_create_valid_stream(self, test_session):
        """Test creating a valid LiveStream."""
        stream = LiveStream(
            server_seed_hashed="abc123def456",
            client_seed="test_client_seed",
            notes="Test stream notes"
        )
        
        test_session.add(stream)
        test_session.commit()
        
        # Verify the stream was created
        assert stream.id is not None
        assert isinstance(stream.id, UUID)
        assert stream.server_seed_hashed == "abc123def456"
        assert stream.client_seed == "test_client_seed"
        assert stream.notes == "Test stream notes"
        assert isinstance(stream.created_at, datetime)
        assert isinstance(stream.last_seen_at, datetime)

    def test_stream_defaults(self, test_session):
        """Test that default values are set correctly."""
        stream = LiveStream(
            server_seed_hashed="test_hash",
            client_seed="test_client"
        )
        
        test_session.add(stream)
        test_session.commit()
        
        # Check defaults
        assert stream.id is not None
        assert stream.notes is None
        assert stream.created_at is not None
        assert stream.last_seen_at is not None

    def test_unique_seed_pair_constraint(self, test_session):
        """Test that seed pair uniqueness is enforced."""
        # Create first stream
        stream1 = LiveStream(
            server_seed_hashed="same_hash",
            client_seed="same_client"
        )
        test_session.add(stream1)
        test_session.commit()
        
        # Try to create second stream with same seed pair
        stream2 = LiveStream(
            server_seed_hashed="same_hash",
            client_seed="same_client"
        )
        test_session.add(stream2)
        
        with pytest.raises(IntegrityError) as exc_info:
            test_session.commit()
        
        assert "UNIQUE constraint failed" in str(exc_info.value)

    def test_different_seed_pairs_allowed(self, test_session):
        """Test that different seed pairs can coexist."""
        stream1 = LiveStream(
            server_seed_hashed="hash1",
            client_seed="client1"
        )
        stream2 = LiveStream(
            server_seed_hashed="hash2",
            client_seed="client1"  # Same client, different server
        )
        stream3 = LiveStream(
            server_seed_hashed="hash1",
            client_seed="client2"  # Same server, different client
        )
        
        test_session.add_all([stream1, stream2, stream3])
        test_session.commit()
        
        # All should be created successfully
        assert stream1.id is not None
        assert stream2.id is not None
        assert stream3.id is not None

    def test_required_fields(self, test_session):
        """Test that required fields cannot be null."""
        # Missing server_seed_hashed
        with pytest.raises((IntegrityError, TypeError)):
            stream = LiveStream(client_seed="test")
            test_session.add(stream)
            test_session.commit()
        
        test_session.rollback()
        
        # Missing client_seed
        with pytest.raises((IntegrityError, TypeError)):
            stream = LiveStream(server_seed_hashed="test")
            test_session.add(stream)
            test_session.commit()


class TestLiveBetModel:
    """Test LiveBet model validation and constraints."""

    @pytest.fixture
    def sample_stream(self, test_session):
        """Create a sample stream for bet testing."""
        stream = LiveStream(
            server_seed_hashed="test_hash",
            client_seed="test_client"
        )
        test_session.add(stream)
        test_session.commit()
        return stream

    def test_create_valid_bet(self, test_session, sample_stream):
        """Test creating a valid LiveBet."""
        bet = LiveBet(
            stream_id=sample_stream.id,
            antebot_bet_id="bet_123",
            nonce=1,
            amount=10.0,
            payout_multiplier=2.5,
            payout=25.0,
            difficulty="medium",
            round_target=100.0,
            round_result=250.0
        )
        
        test_session.add(bet)
        test_session.commit()
        
        # Verify the bet was created
        assert bet.id is not None
        assert bet.stream_id == sample_stream.id
        assert bet.antebot_bet_id == "bet_123"
        assert bet.nonce == 1
        assert bet.amount == 10.0
        assert bet.payout_multiplier == 2.5
        assert bet.payout == 25.0
        assert bet.difficulty == "medium"
        assert bet.round_target == 100.0
        assert bet.round_result == 250.0
        assert isinstance(bet.received_at, datetime)

    def test_bet_defaults(self, test_session, sample_stream):
        """Test that default values are set correctly."""
        bet = LiveBet(
            stream_id=sample_stream.id,
            antebot_bet_id="bet_456",
            nonce=2,
            amount=5.0,
            payout_multiplier=1.5,
            payout=7.5,
            difficulty="easy"
        )
        
        test_session.add(bet)
        test_session.commit()
        
        # Check defaults
        assert bet.id is not None
        assert bet.received_at is not None
        assert bet.date_time is None
        assert bet.round_target is None
        assert bet.round_result is None

    def test_nonce_constraint(self, test_session, sample_stream):
        """Test that nonce must be >= 1."""
        # Valid nonce
        bet_valid = LiveBet(
            stream_id=sample_stream.id,
            antebot_bet_id="bet_valid",
            nonce=1,
            amount=10.0,
            payout_multiplier=2.0,
            payout=20.0,
            difficulty="easy"
        )
        test_session.add(bet_valid)
        test_session.commit()
        
        # Invalid nonce (0)
        bet_invalid = LiveBet(
            stream_id=sample_stream.id,
            antebot_bet_id="bet_invalid",
            nonce=0,
            amount=10.0,
            payout_multiplier=2.0,
            payout=20.0,
            difficulty="easy"
        )
        test_session.add(bet_invalid)
        
        with pytest.raises(IntegrityError) as exc_info:
            test_session.commit()
        
        assert "ck_live_bets_nonce_ge_1" in str(exc_info.value)

    def test_amount_constraint(self, test_session, sample_stream):
        """Test that amount must be >= 0."""
        # Valid amount (0)
        bet_valid = LiveBet(
            stream_id=sample_stream.id,
            antebot_bet_id="bet_valid",
            nonce=1,
            amount=0.0,
            payout_multiplier=2.0,
            payout=0.0,
            difficulty="easy"
        )
        test_session.add(bet_valid)
        test_session.commit()
        
        # Invalid amount (negative)
        bet_invalid = LiveBet(
            stream_id=sample_stream.id,
            antebot_bet_id="bet_invalid",
            nonce=2,
            amount=-5.0,
            payout_multiplier=2.0,
            payout=20.0,
            difficulty="easy"
        )
        test_session.add(bet_invalid)
        
        with pytest.raises(IntegrityError) as exc_info:
            test_session.commit()
        
        assert "ck_live_bets_amount_ge_0" in str(exc_info.value)

    def test_payout_constraint(self, test_session, sample_stream):
        """Test that payout must be >= 0."""
        # Valid payout (0)
        bet_valid = LiveBet(
            stream_id=sample_stream.id,
            antebot_bet_id="bet_valid",
            nonce=1,
            amount=10.0,
            payout_multiplier=0.0,
            payout=0.0,
            difficulty="easy"
        )
        test_session.add(bet_valid)
        test_session.commit()
        
        # Invalid payout (negative)
        bet_invalid = LiveBet(
            stream_id=sample_stream.id,
            antebot_bet_id="bet_invalid",
            nonce=2,
            amount=10.0,
            payout_multiplier=2.0,
            payout=-10.0,
            difficulty="easy"
        )
        test_session.add(bet_invalid)
        
        with pytest.raises(IntegrityError) as exc_info:
            test_session.commit()
        
        assert "ck_live_bets_payout_ge_0" in str(exc_info.value)

    def test_difficulty_constraint(self, test_session, sample_stream):
        """Test that difficulty must be one of the allowed values."""
        # Valid difficulties
        valid_difficulties = ["easy", "medium", "hard", "expert"]
        
        for i, difficulty in enumerate(valid_difficulties, 1):
            bet = LiveBet(
                stream_id=sample_stream.id,
                antebot_bet_id=f"bet_{i}",
                nonce=i,
                amount=10.0,
                payout_multiplier=2.0,
                payout=20.0,
                difficulty=difficulty
            )
            test_session.add(bet)
        
        test_session.commit()
        
        # Invalid difficulty
        bet_invalid = LiveBet(
            stream_id=sample_stream.id,
            antebot_bet_id="bet_invalid",
            nonce=10,
            amount=10.0,
            payout_multiplier=2.0,
            payout=20.0,
            difficulty="invalid"
        )
        test_session.add(bet_invalid)
        
        with pytest.raises(IntegrityError) as exc_info:
            test_session.commit()
        
        assert "ck_live_bets_difficulty" in str(exc_info.value)

    def test_round_target_constraint(self, test_session, sample_stream):
        """Test that round_target must be > 0 if provided."""
        # Valid round_target (positive)
        bet_valid = LiveBet(
            stream_id=sample_stream.id,
            antebot_bet_id="bet_valid",
            nonce=1,
            amount=10.0,
            payout_multiplier=2.0,
            payout=20.0,
            difficulty="easy",
            round_target=100.0
        )
        test_session.add(bet_valid)
        test_session.commit()
        
        # Invalid round_target (zero)
        bet_invalid = LiveBet(
            stream_id=sample_stream.id,
            antebot_bet_id="bet_invalid",
            nonce=2,
            amount=10.0,
            payout_multiplier=2.0,
            payout=20.0,
            difficulty="easy",
            round_target=0.0
        )
        test_session.add(bet_invalid)
        
        with pytest.raises(IntegrityError) as exc_info:
            test_session.commit()
        
        assert "ck_live_bets_round_target_gt_0" in str(exc_info.value)

    def test_round_result_constraint(self, test_session, sample_stream):
        """Test that round_result must be >= 0 if provided."""
        # Valid round_result (zero)
        bet_valid = LiveBet(
            stream_id=sample_stream.id,
            antebot_bet_id="bet_valid",
            nonce=1,
            amount=10.0,
            payout_multiplier=2.0,
            payout=20.0,
            difficulty="easy",
            round_result=0.0
        )
        test_session.add(bet_valid)
        test_session.commit()
        
        # Invalid round_result (negative)
        bet_invalid = LiveBet(
            stream_id=sample_stream.id,
            antebot_bet_id="bet_invalid",
            nonce=2,
            amount=10.0,
            payout_multiplier=2.0,
            payout=20.0,
            difficulty="easy",
            round_result=-5.0
        )
        test_session.add(bet_invalid)
        
        with pytest.raises(IntegrityError) as exc_info:
            test_session.commit()
        
        assert "ck_live_bets_round_result_ge_0" in str(exc_info.value)

    def test_unique_bet_per_stream_constraint(self, test_session, sample_stream):
        """Test that antebot_bet_id must be unique per stream."""
        # Create first bet
        bet1 = LiveBet(
            stream_id=sample_stream.id,
            antebot_bet_id="duplicate_bet",
            nonce=1,
            amount=10.0,
            payout_multiplier=2.0,
            payout=20.0,
            difficulty="easy"
        )
        test_session.add(bet1)
        test_session.commit()
        
        # Try to create second bet with same antebot_bet_id in same stream
        bet2 = LiveBet(
            stream_id=sample_stream.id,
            antebot_bet_id="duplicate_bet",
            nonce=2,
            amount=15.0,
            payout_multiplier=3.0,
            payout=45.0,
            difficulty="medium"
        )
        test_session.add(bet2)
        
        with pytest.raises(IntegrityError) as exc_info:
            test_session.commit()
        
        assert "UNIQUE constraint failed" in str(exc_info.value)

    def test_same_bet_id_different_streams_allowed(self, test_session):
        """Test that same antebot_bet_id can exist in different streams."""
        # Create two streams
        stream1 = LiveStream(
            server_seed_hashed="hash1",
            client_seed="client1"
        )
        stream2 = LiveStream(
            server_seed_hashed="hash2",
            client_seed="client2"
        )
        test_session.add_all([stream1, stream2])
        test_session.commit()
        
        # Create bets with same antebot_bet_id in different streams
        bet1 = LiveBet(
            stream_id=stream1.id,
            antebot_bet_id="same_bet_id",
            nonce=1,
            amount=10.0,
            payout_multiplier=2.0,
            payout=20.0,
            difficulty="easy"
        )
        bet2 = LiveBet(
            stream_id=stream2.id,
            antebot_bet_id="same_bet_id",
            nonce=1,
            amount=15.0,
            payout_multiplier=3.0,
            payout=45.0,
            difficulty="medium"
        )
        
        test_session.add_all([bet1, bet2])
        test_session.commit()
        
        # Both should be created successfully
        assert bet1.id is not None
        assert bet2.id is not None


class TestSeedAliasModel:
    """Test SeedAlias model validation and constraints."""

    def test_create_valid_seed_alias(self, test_session):
        """Test creating a valid SeedAlias."""
        alias = SeedAlias(
            server_seed_hashed="abc123def456",
            server_seed_plain="plain_seed_text"
        )
        
        test_session.add(alias)
        test_session.commit()
        
        # Verify the alias was created
        assert alias.server_seed_hashed == "abc123def456"
        assert alias.server_seed_plain == "plain_seed_text"
        assert isinstance(alias.first_seen, datetime)
        assert isinstance(alias.last_seen, datetime)

    def test_seed_alias_defaults(self, test_session):
        """Test that default timestamps are set correctly."""
        alias = SeedAlias(
            server_seed_hashed="test_hash",
            server_seed_plain="test_plain"
        )
        
        test_session.add(alias)
        test_session.commit()
        
        # Check defaults
        assert alias.first_seen is not None
        assert alias.last_seen is not None

    def test_unique_hashed_seed_constraint(self, test_session):
        """Test that server_seed_hashed must be unique."""
        # Create first alias
        alias1 = SeedAlias(
            server_seed_hashed="unique_hash",
            server_seed_plain="plain1"
        )
        test_session.add(alias1)
        test_session.commit()
        
        # Try to create second alias with same hash
        alias2 = SeedAlias(
            server_seed_hashed="unique_hash",
            server_seed_plain="plain2"
        )
        test_session.add(alias2)
        
        with pytest.raises(IntegrityError) as exc_info:
            test_session.commit()
        
        assert "UNIQUE constraint failed" in str(exc_info.value)

    def test_required_fields(self, test_session):
        """Test that required fields cannot be null."""
        # Missing server_seed_hashed
        with pytest.raises((IntegrityError, TypeError)):
            alias = SeedAlias(server_seed_plain="test")
            test_session.add(alias)
            test_session.commit()
        
        test_session.rollback()
        
        # Missing server_seed_plain
        with pytest.raises((IntegrityError, TypeError)):
            alias = SeedAlias(server_seed_hashed="test")
            test_session.add(alias)
            test_session.commit()


class TestRelationshipIntegrity:
    """Test relationship integrity and cascade operations."""

    def test_cascade_delete_bets_when_stream_deleted(self, test_session):
        """Test that deleting a stream cascades to delete all associated bets."""
        # Create stream
        stream = LiveStream(
            server_seed_hashed="cascade_test",
            client_seed="cascade_client"
        )
        test_session.add(stream)
        test_session.commit()
        
        # Create multiple bets for the stream
        bets = []
        for i in range(3):
            bet = LiveBet(
                stream_id=stream.id,
                antebot_bet_id=f"bet_{i}",
                nonce=i + 1,
                amount=10.0,
                payout_multiplier=2.0,
                payout=20.0,
                difficulty="easy"
            )
            bets.append(bet)
        
        test_session.add_all(bets)
        test_session.commit()
        
        # Verify bets exist
        bet_count = test_session.exec(
            select(LiveBet).where(LiveBet.stream_id == stream.id)
        ).all()
        assert len(bet_count) == 3
        
        # Delete the stream
        test_session.delete(stream)
        test_session.commit()
        
        # Verify all bets were cascade deleted
        remaining_bets = test_session.exec(
            select(LiveBet).where(LiveBet.stream_id == stream.id)
        ).all()
        assert len(remaining_bets) == 0

    def test_foreign_key_constraint_prevents_orphaned_bets(self, test_session):
        """Test that foreign key constraint prevents creating bets with invalid stream_id."""
        # Try to create bet with non-existent stream_id
        fake_stream_id = uuid4()
        bet = LiveBet(
            stream_id=fake_stream_id,
            antebot_bet_id="orphan_bet",
            nonce=1,
            amount=10.0,
            payout_multiplier=2.0,
            payout=20.0,
            difficulty="easy"
        )
        
        test_session.add(bet)
        
        with pytest.raises(IntegrityError) as exc_info:
            test_session.commit()
        
        # Should be a foreign key constraint violation
        assert "FOREIGN KEY constraint failed" in str(exc_info.value)

    def test_stream_bet_relationship_query(self, test_session):
        """Test querying bets through stream relationship."""
        # Create stream
        stream = LiveStream(
            server_seed_hashed="relationship_test",
            client_seed="relationship_client"
        )
        test_session.add(stream)
        test_session.commit()
        
        # Create bets
        bet1 = LiveBet(
            stream_id=stream.id,
            antebot_bet_id="bet_1",
            nonce=1,
            amount=10.0,
            payout_multiplier=2.0,
            payout=20.0,
            difficulty="easy"
        )
        bet2 = LiveBet(
            stream_id=stream.id,
            antebot_bet_id="bet_2",
            nonce=2,
            amount=15.0,
            payout_multiplier=3.0,
            payout=45.0,
            difficulty="medium"
        )
        
        test_session.add_all([bet1, bet2])
        test_session.commit()
        
        # Query bets for the stream
        stream_bets = test_session.exec(
            select(LiveBet).where(LiveBet.stream_id == stream.id)
        ).all()
        
        assert len(stream_bets) == 2
        bet_ids = {bet.antebot_bet_id for bet in stream_bets}
        assert bet_ids == {"bet_1", "bet_2"}


if __name__ == "__main__":
    pytest.main([__file__, "-v"])