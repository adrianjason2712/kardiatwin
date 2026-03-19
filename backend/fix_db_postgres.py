import sys
import os
import logging

# Configure logging to see what's happening
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Add the backend directory to the path 
sys.path.append(os.getcwd())

try:
    from models import engine, Base, User, UserProfile, SimulationSession, init_db
    from sqlalchemy import inspect
    
    def force_db_sync():
        logger.info("--- PostgreSQL Forced Schema Sync ---")
        
        # 1. Inspect existing tables
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        logger.info(f"Existing tables in DB: {existing_tables}")
        
        # 2. Call init_db (Base.metadata.create_all(engine))
        logger.info("Creating missing tables...")
        init_db()
        
        # 3. Verify again
        inspector = inspect(engine)
        new_tables = inspector.get_table_names()
        logger.info(f"Updated tables in DB: {new_tables}")
        
        if 'user_profiles' in new_tables:
            logger.info("[SUCCESS] 'user_profiles' table is now present.")
        else:
            logger.error("[FAILURE] 'user_profiles' table is still missing!")

    if __name__ == "__main__":
        force_db_sync()

except Exception as e:
    logger.error(f"Critical error during DB sync: {e}", exc_info=True)
    sys.exit(1)
