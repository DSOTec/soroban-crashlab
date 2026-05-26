#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct SorobanExampleContract;

#[contractimpl]
impl SorobanExampleContract {
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_hello() {
        let env = Env::default();
        let contract_id = env.register(SorobanExampleContract, ());
        let client = SorobanExampleContractClient::new(&env, &contract_id);

        let result = client.hello(&symbol_short!("Dev"));
        assert_eq!(
            result,
            vec![&env, symbol_short!("Hello"), symbol_short!("Dev")]
        );
    }
}
